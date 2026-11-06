/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterAll, test, expect } from 'vitest';
import { insertNoteReview } from '@/misc/note-review.js';
import { api, connectStream, initTestDb, role, signup } from '../utils.js';
import type { DataSource } from 'typeorm';

let db: DataSource | undefined;
afterAll(async () => { await db?.destroy(); });

test('HTTP/SQL: independent configuration and atomic, private, durable review cases', async () => {
	const database = await initTestDb(true);
	db = database;
	const admin = await signup({ username: 'review_admin' });
	const user = await signup({ username: 'review_user' });
	const moderator = await signup({ username: 'review_mod' });
	const modRole = await role(admin, { isModerator: true });
	expect((await api('admin/roles/assign', { roleId: modRole.id, userId: moderator.id }, admin)).status).toBe(204);
	await expect.poll(async () => (await api('i', {}, moderator)).body.isModerator).toBe(true);
	for (const actor of [user, moderator]) {
		expect((await api('admin/update-meta', { reviewWords: ['termoalfa'] }, actor)).status).toBe(403);
		expect((await api('admin/meta', {}, actor)).status).toBe(403);
	}
	for (const reviewWords of [['termo*'], ['/termo/i'], ['ﬃ'.repeat(34)]]) {
		expect((await api('admin/update-meta', { reviewWords }, admin)).status).toBe(400);
	}
	const originalAdminMeta = await api('admin/meta', {}, admin);
	expect(originalAdminMeta.body.reviewWords).toEqual([]);
	const empty = await api('notes/create', { text: 'termoalfa' }, user);
	expect(empty.status).toBe(200);
	expect(empty.body.createdNote.visibility).toBe('public');
	expect(await database.query('SELECT * FROM note_review')).toEqual([]);
	expect((await api('admin/update-meta', { reviewWords: [' TERMOALFA ', 'termoalfa', 'termoBETA', '', 'CAFÉ', 'cafe\u0301'] }, admin)).status).toBe(204);
	await expect.poll(async () => (await api('admin/meta', {}, admin)).body.reviewWords).toEqual(['termoalfa', 'termobeta', 'café']);
	expect(await database.query('SELECT * FROM note_review WHERE "originalNoteId"=$1', [empty.body.createdNote.id])).toEqual([]);
	const configured = (await api('admin/meta', {}, admin)).body;
	expect(configured.sensitiveWords).toEqual(originalAdminMeta.body.sensitiveWords);
	expect(configured.prohibitedWords).toEqual(originalAdminMeta.body.prohibitedWords);
	const publicMeta = await api('meta', { detail: true }, user);
	expect(publicMeta.status).toBe(200);
	expect(JSON.stringify(publicMeta.body)).not.toMatch(/reviewWords|termoalfa|termobeta|café/u);
	const logs = await api('admin/show-moderation-logs', { type: 'updateServerSettings', limit: 100 }, admin);
	expect(logs.status).toBe(200);
	expect(JSON.stringify(logs.body)).not.toMatch(/termoalfa|termobeta|café/u);
	await expect.poll(async () => (await api('admin/show-moderation-logs', { type: 'updateServerSettings', limit: 100 }, admin)).body.some(log => (log.info as { changedFields?: string[] }).changedFields?.includes('reviewWords'))).toBe(true);
	const rawLogs = await database.query('SELECT info FROM moderation_log WHERE type=\'updateServerSettings\'');
	expect(JSON.stringify(rawLogs)).not.toMatch(/termoalfa|termobeta|café/u);

	const create = async (params: Record<string, unknown>) => {
		const response = await api('notes/create', params as never, user);
		expect(response.status).toBe(200);
		return response.body.createdNote;
	};
	const matched = await create({ text: 'termoalfa! TERMOALFA termoBETA', localOnly: true });
	expect(matched.visibility).toBe('public');
	expect((await api('notes/show', { noteId: matched.id }, admin)).status).toBe(200);
	const cases = () => database.query('SELECT * FROM note_review WHERE "originalNoteId"=$1', [matched.id]);
	const first = (await cases())[0];
	expect(first).toMatchObject({ originalNoteId: matched.id, noteId: matched.id, matchedWords: ['termoalfa', 'termobeta'], state: 'pending' });
	expect(first.createdAt).toBeInstanceOf(Date);
	expect(Object.keys(first).sort()).toEqual(['createdAt', 'matchedWords', 'noteId', 'originalNoteId', 'state'].sort());
	// Multiple attempts use independent transactions/connections; no state reset on conflict.
	await database.query('UPDATE note_review SET state=\'resolved\' WHERE "originalNoteId"=$1', [matched.id]);
	await Promise.all(Array.from({ length: 8 }, () => database.transaction(manager => insertNoteReview(manager, matched.id, ['termoalfa']))));
	expect(await cases()).toEqual([{ ...first, state: 'resolved' }]);
	await database.query('UPDATE note_review SET state=\'pending\' WHERE "originalNoteId"=$1', [matched.id]);

	const noMatch = await create({ text: 'alfa', cw: 'termo', poll: { choices: ['termo', 'alfa'] } });
	expect(await database.query('SELECT * FROM note_review WHERE "originalNoteId"=$1', [noMatch.id])).toEqual([]);
	const original = await create({ text: 'termoalfa' });
	for (const params of [{ text: 'neutro', renoteId: original.id }, { renoteId: original.id }, { text: 'neutro', replyId: original.id }, { text: 'supertermoalfa termoalfabeta' }]) {
		const excluded = await create(params);
		expect(await database.query('SELECT * FROM note_review WHERE "originalNoteId"=$1', [excluded.id])).toEqual([]);
	}
	for (const params of [{ text: 'termoalfa', visibility: 'home' }, { text: 'termoalfa', visibility: 'followers' }, { text: 'termoalfa', visibility: 'specified', visibleUserIds: [admin.id] }]) {
		const excluded = await create(params);
		expect(await database.query('SELECT * FROM note_review WHERE "originalNoteId"=$1', [excluded.id])).toEqual([]);
	}
	for (const params of [{ text: 'termoalfa', replyId: original.id }, { text: 'neutro', cw: 'termoalfa' }, { text: 'neutro', poll: { choices: ['termoalfa', 'neutro'] } }]) {
		const included = await create(params);
		expect((await database.query('SELECT * FROM note_review WHERE "originalNoteId"=$1', [included.id]))).toHaveLength(1);
	}
	expect((await api('admin/update-meta', { sensitiveWords: ['reduzir'] }, admin)).status).toBe(204);
	// Ensure the propagated effective setting is active before checking the final visibility.
	await expect.poll(async () => (await create({ text: 'reduzir' })).visibility).toBe('home');
	const home = await create({ text: 'reduzir termoalfa' });
	expect(home.visibility).toBe('home');
	expect(await database.query('SELECT * FROM note_review WHERE "originalNoteId"=$1', [home.id])).toEqual([]);

	// Fail after the note/poll inserts, inside the case insertion, using a DB trigger.
	// Hold the trigger open briefly to observe that no public event escapes before commit.
	const received: string[] = [];
	const stream = await connectStream(user, 'localTimeline', event => {
		if (event.type === 'note' && typeof event.body?.text === 'string') received.push(event.body.text);
	});
	try {
		await database.query('CREATE FUNCTION review_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.3); RAISE EXCEPTION \'fictional review insert failure\'; END $$');
		await database.query('CREATE TRIGGER review_test_fail BEFORE INSERT ON note_review FOR EACH ROW EXECUTE FUNCTION review_test_fail()');
		for (const withPoll of [false, true]) {
			const text = `termoalfa rollback-${withPoll}`;
			const response = await api('notes/create', { text, ...(withPoll ? { poll: { choices: ['neutro', 'outro'] } } : {}) }, user);
			expect(response.status).toBe(500);
			expect(await database.query('SELECT id FROM note WHERE text=$1', [text])).toEqual([]);
			expect(received).not.toContain(text);
		}
	} finally {
		await database.query('DROP TRIGGER IF EXISTS review_test_fail ON note_review');
		await database.query('DROP FUNCTION IF EXISTS review_test_fail()');
		stream.close();
	}
	expect(await database.query('SELECT p."noteId" FROM poll p LEFT JOIN note n ON n.id=p."noteId" WHERE n.id IS NULL')).toEqual([]);
	expect(await database.query('SELECT r."originalNoteId" FROM note_review r LEFT JOIN note n ON n.id=r."noteId" WHERE r."noteId" IS NOT NULL AND n.id IS NULL')).toEqual([]);
	expect(await database.query('SELECT id FROM abuse_user_report')).toEqual([]);
	expect((await api('notes/delete', { noteId: matched.id }, user)).status).toBe(204);
	expect(await cases()).toEqual([{ ...first, noteId: null }]);
	expect((await api('notes/show', { noteId: matched.id }, admin)).status).toBe(400);
	await Promise.all(Array.from({ length: 4 }, () => database.transaction(manager => insertNoteReview(manager, matched.id, ['termoalfa']))));
	expect(await cases()).toEqual([{ ...first, noteId: null }]);
}, 120000);
