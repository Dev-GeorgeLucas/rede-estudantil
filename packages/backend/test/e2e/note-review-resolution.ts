/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterAll, expect, test } from 'vitest';
import { api, connectStream, initTestDb, role, signup } from '../utils.js';
import type { DataSource } from 'typeorm';

let db: DataSource | undefined;
afterAll(async () => { await db?.destroy(); });

test('HTTP/SQL/WebSocket: rule configuration, review queue, atomic decisions and human report regression', async () => {
	const database = await initTestDb(true);
	db = database;
	const admin = await signup({ username: 'rule_admin' });
	const author = await signup({ username: 'rule_author' });
	const reporter = await signup({ username: 'rule_reporter' });
	const mod = await signup({ username: 'rule_moderator' });
	const mod2 = await signup({ username: 'rule_moderator_two' });
	const modRole = await role(admin, { isModerator: true });
	for (const moderator of [mod, mod2]) {
		expect((await api('admin/roles/assign', { roleId: modRole.id, userId: moderator.id }, admin)).status).toBe(204);
		await expect.poll(async () => (await api('i', {}, moderator)).body.isModerator).toBe(true);
	}
	for (const user of [undefined, author]) {
		expect((await api('admin/note-reviews', {}, user)).status).toBe(user ? 403 : 401);
		expect((await api('admin/resolve-note-review', { caseId: author.id, resolution: 'reviewed' }, user)).status).toBe(user ? 403 : 401);
	}
	for (const user of [author, mod]) {
		expect((await api('admin/update-meta', { reviewWords: ['termoalfa'] }, user)).status).toBe(403);
		expect((await api('admin/meta', {}, user)).status).toBe(403);
	}
	expect((await api('admin/update-meta', { reviewWords: ['termoalfa', 'termobeta'] }, admin)).status).toBe(204);
	await expect.poll(async () => (await api('admin/meta', {}, admin)).body.reviewWords).toEqual(['termoalfa', 'termobeta']);
	expect(JSON.stringify((await api('meta', { detail: true }, author)).body)).not.toMatch(/reviewWords|termoalfa|termobeta/u);
	const before = (await api('admin/note-reviews', {}, mod)).body;
	expect(before).toEqual([]);

	const events: { type: string; body: unknown }[] = [];
	const stream = await connectStream(mod, 'admin', event => events.push(event as never));
	const adminEvents: unknown[] = [];
	const adminStream = await connectStream(admin, 'admin', event => adminEvents.push(event));
	try {
		const create = async (text = 'termoalfa! termobeta') => {
			const response = await api('notes/create', { text, localOnly: true }, author);
			expect(response.status).toBe(200);
			return response.body.createdNote;
		};
		const note = await create();
		await expect.poll(() => events.filter(event => event.type === 'noteReviewCreated').length).toBe(1);
		await expect.poll(() => adminEvents.length).toBeGreaterThan(0);
		expect(events[0]).toMatchObject({ type: 'noteReviewCreated', body: {} });
		expect(Object.keys(events[0].body as object)).toEqual([]);
		const queued = await api('admin/note-reviews', {}, mod);
		expect(queued.status).toBe(200);
		expect(queued.body).toHaveLength(1);
		expect(queued.body[0]).toMatchObject({ id: note.id, noteId: note.id, state: 'pending', matchedWords: ['termoalfa', 'termobeta'], resolvedAt: null, resolvedById: null, resolution: null });
		expect(queued.body[0]).not.toHaveProperty('text');
		expect(queued.body[0]).not.toHaveProperty('reporterId');
		expect((await api('notes/show', { noteId: note.id }, mod)).body.text).toBe(note.text);

		// A human report remains a separate queue and is not resolved by a rule decision.
		expect((await api('users/report-abuse', { userId: author.id, comment: 'Fictional human report for regression' }, reporter)).status).toBe(204);
		await expect.poll(async () => (await api('admin/abuse-user-reports', { state: 'unresolved', limit: 1 }, mod)).body.length).toBe(1);
		const humanReport = (await api('admin/abuse-user-reports', { state: 'unresolved', limit: 1 }, mod)).body[0];

		const decisions = await Promise.all([
			api('admin/resolve-note-review', { caseId: note.id, resolution: 'falsePositive' }, mod),
			api('admin/resolve-note-review', { caseId: note.id, resolution: 'reviewed' }, mod2),
		]);
		for (const response of decisions) expect(response.status).toBe(200);
		expect(decisions.map(response => response.body.alreadyResolved).sort()).toEqual([false, true]);
		const winner = decisions.find(response => !response.body.alreadyResolved)!.body;
		for (const response of decisions) expect(response.body).toMatchObject({ resolvedById: winner.resolvedById, resolvedAt: winner.resolvedAt, resolution: winner.resolution });
		const repeated = await api('admin/resolve-note-review', { caseId: note.id, resolution: 'unavailable' }, admin);
		expect(repeated.body).toMatchObject({ alreadyResolved: true, resolvedById: winner.resolvedById, resolvedAt: winner.resolvedAt, resolution: winner.resolution });
		await expect.poll(() => events.filter(event => event.type === 'noteReviewResolved').length).toBe(1);
		expect(events.find(event => event.type === 'noteReviewResolved')).toMatchObject({ type: 'noteReviewResolved', body: {} });
		expect(Object.keys(events.find(event => event.type === 'noteReviewResolved')!.body as object)).toEqual([]);
		expect((await api('admin/note-reviews', { state: 'pending' }, mod)).body).toEqual([]);
		const { alreadyResolved: _alreadyResolved, ...persistedDecision } = winner;
		expect((await api('admin/note-reviews', { state: 'resolved' }, mod)).body[0]).toMatchObject(persistedDecision);
		expect((await api('admin/note-reviews', { state: 'all', caseIds: [note.id] }, mod)).body).toEqual([persistedDecision]);
		const stored = (await database.query('SELECT * FROM note_review WHERE "originalNoteId"=$1', [note.id]))[0];
		expect(stored).toMatchObject({ state: 'resolved', resolvedById: winner.resolvedById, resolution: winner.resolution });
		expect(stored.resolvedAt.toISOString()).toBe(winner.resolvedAt);
		const logs = await database.query('SELECT * FROM moderation_log WHERE type=\'resolveNoteReview\'');
		expect(logs).toHaveLength(1);
		expect(logs[0].userId).toBe(winner.resolvedById);
		expect(logs[0].info).toEqual({ caseId: note.id, resolution: winner.resolution, resolvedAt: winner.resolvedAt });
		const history = await api('admin/show-moderation-logs', { type: 'resolveNoteReview' }, admin);
		expect(history.body).toHaveLength(1);
		expect(JSON.stringify(history.body)).not.toMatch(/termoalfa|termobeta|Fictional human report/u);
		expect((await api('notes/show', { noteId: note.id }, mod)).body.visibility).toBe('public');
		const user = (await api('users/show', { userId: author.id }, admin)).body;
		expect(user.isSuspended).toBe(false);
		expect(user.isSilenced).toBe(false);
		expect((await api('admin/abuse-user-reports', { state: 'unresolved' }, mod)).body.map(report => report.id)).toContain(humanReport.id);
		expect((await api('admin/resolve-abuse-user-report', { reportId: humanReport.id }, mod)).status).toBe(204);
		expect((await api('admin/abuse-user-reports', { state: 'unresolved' }, mod)).body).toEqual([]);

		// Cursor order uses the immutable original note ID, not mutable resolution time.
		for (let i = 0; i < 4; i++) await create(`termoalfa pagination ${i}`);
		const first = (await api('admin/note-reviews', { limit: 2 }, mod)).body;
		expect(first).toHaveLength(2);
		expect((await api('admin/resolve-note-review', { caseId: first[0].id, resolution: 'reviewed' }, mod)).status).toBe(200);
		const second = (await api('admin/note-reviews', { limit: 2, untilId: first[1].id }, mod)).body;
		expect(second).toHaveLength(2);
		expect(new Set([...first, ...second].map(item => item.id)).size).toBe(4);
		for (const item of second) expect(item.id < first[1].id).toBe(true);
		for (const params of [{ limit: 0 }, { limit: 101 }, { state: 'unknown' }]) expect((await api('admin/note-reviews', params as never, mod)).status).toBe(400);
		expect((await api('admin/resolve-note-review', { caseId: note.id, resolution: 'punish' } as never, mod)).status).toBe(400);

		const deleted = await create('termoalfa deleted');
		expect((await api('notes/delete', { noteId: deleted.id }, author)).status).toBe(204);
		const deletedCase = (await api('admin/note-reviews', {}, mod)).body.find(item => item.id === deleted.id);
		expect(deletedCase).toBeDefined();
		if (!deletedCase) throw new Error('Expected the deleted note review to remain in the queue');
		expect(deletedCase.noteId).toBeNull();
		expect(deletedCase).not.toHaveProperty('text');
		expect((await api('admin/resolve-note-review', { caseId: deleted.id, resolution: 'unavailable' }, mod)).body.resolution).toBe('unavailable');

		// Reject the audit INSERT in PostgreSQL, proving case and log share a real transaction.
		const rollback = await create('termoalfa audit rollback');
		const beforeEvents = events.filter(event => event.type === 'noteReviewResolved').length;
		try {
			await database.query('CREATE FUNCTION review_audit_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type = \'resolveNoteReview\' THEN RAISE EXCEPTION \'fictional audit failure\'; END IF; RETURN NEW; END $$');
			await database.query('CREATE TRIGGER review_audit_test_fail BEFORE INSERT ON moderation_log FOR EACH ROW EXECUTE FUNCTION review_audit_test_fail()');
			expect((await api('admin/resolve-note-review', { caseId: rollback.id, resolution: 'reviewed' }, mod)).status).toBe(500);
			expect((await database.query('SELECT state, "resolvedAt", "resolvedById", resolution FROM note_review WHERE "originalNoteId"=$1', [rollback.id]))[0]).toEqual({ state: 'pending', resolvedAt: null, resolvedById: null, resolution: null });
			expect(await database.query('SELECT id FROM moderation_log WHERE type=\'resolveNoteReview\' AND info->>\'caseId\'=$1', [rollback.id])).toEqual([]);
			expect(events.filter(event => event.type === 'noteReviewResolved')).toHaveLength(beforeEvents);
		} finally {
			await database.query('DROP TRIGGER IF EXISTS review_audit_test_fail ON moderation_log');
			await database.query('DROP FUNCTION IF EXISTS review_audit_test_fail()');
		}
		expect((await api('admin/resolve-note-review', { caseId: rollback.id, resolution: 'reviewed' }, mod)).status).toBe(200);
		expect(await database.query('SELECT id FROM system_webhook')).toEqual([]);
		expect(await database.query('SELECT id FROM abuse_report_notification_recipient')).toEqual([]);
	} finally { stream.close(); adminStream.close(); }
}, 60000);
