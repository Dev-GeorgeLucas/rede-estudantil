/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { MiNote } from '@/models/Note.js';
import { IdService } from '@/core/IdService.js';
import { loadConfig } from '@/config.js';
import type { entities } from 'misskey-js';
import { api, post, signup, randomString, initTestDb, castAsError } from '../utils.js';

// Separate suite: authentication, SQL filtering, packing and cursor regressions.
// Uses only the isolated e2e database/Redis configured in .config/test.yml.
describe('Discovery', () => {
	let root: entities.SignupResponse;
	let viewer: entities.SignupResponse;
	let author: entities.SignupResponse;
	let anchor: entities.Note;

	beforeAll(async () => {
		root = await signup({ username: 'root' });
	});

	beforeEach(async () => {
		viewer = await signup();
		author = await signup();
		anchor = await post(viewer, { text: 'test boundary' });
	});

	async function discovery(params: entities.NotesDiscoveryRequest = {}) {
		const res = await api('notes/discovery', {
			sinceId: anchor.id,
			untilId: 'zzzzzzzzzzzzzzzzzzzzzzzzzz',
			limit: 100,
			...params,
		}, viewer);
		expect(res.status).toBe(200);
		return res.body;
	}

	test('requires authentication', async () => {
		expect((await api('notes/discovery', {})).status).toBe(401);
	});

	test('returns a local public original, including localOnly, polls and CW', async () => {
		const note = await post(author, {
			text: 'local discovery', localOnly: true, cw: 'sensitive subject',
			poll: { choices: ['yes', 'no'], multiple: false, expiredAfter: 60000 },
		});
		const notes = await discovery();
		expect(notes.map(n => n.id)).toEqual([note.id]);
		expect(notes[0].cw).toBe('sensitive subject');
		expect(notes[0].poll?.choices).toHaveLength(2);
	});

	test('excludes self and followed authors; a new request reflects unfollowing', async () => {
		await post(viewer, { text: 'self' });
		const note = await post(author, { text: 'followed' });
		expect((await api('following/create', { userId: author.id }, viewer)).status).toBe(200);
		expect(await discovery()).toEqual([]);
		await api('following/delete', { userId: author.id }, viewer);
		expect((await discovery()).map(n => n.id)).toEqual([note.id]);
	});

	test('excludes remote authors and their public posts', async () => {
		const remote = await signup({ host: `${randomString()}.example.com` });
		await post(remote, { text: 'remote' });
		expect(await discovery()).toEqual([]);
	});

	test.each(['home', 'followers', 'specified'] as const)('excludes %s visibility even if accessible', async visibility => {
		await post(author, { text: 'not public', visibility, visibleUserIds: visibility === 'specified' ? [viewer.id] : undefined });
		expect(await discovery()).toEqual([]);
	});

	test('excludes replies including self replies', async () => {
		const original = await post(author, { text: 'original' });
		await post(author, { text: 'self reply', replyId: original.id });
		await post(author, { text: 'reply', replyId: anchor.id });
		expect((await discovery()).map(n => n.id)).toEqual([original.id]);
	});

	test.each(['outgoing', 'incoming'])('respects %s blocks', async direction => {
		await post(author, { text: 'blocked' });
		const blocker = direction === 'outgoing' ? viewer : author;
		const blockee = direction === 'outgoing' ? author : viewer;
		expect((await api('blocking/create', { userId: blockee.id }, blocker)).status).toBe(200);
		expect(await discovery()).toEqual([]);
	});

	test('respects user mutes', async () => {
		await post(author, { text: 'muted author' });
		expect((await api('mute/create', { userId: author.id }, viewer)).status).toBe(204);
		expect(await discovery()).toEqual([]);
	});

	test('excludes suspended authors', async () => {
		await post(author, { text: 'suspended' });
		expect((await api('admin/suspend-user', { userId: author.id }, root)).status).toBe(204);
		expect(await discovery()).toEqual([]);
	});

	test('keeps community posts and quotes in their own area', async () => {
		const channel = (await api('channels/create', { name: 'community' }, author)).body;
		const note = await post(author, { text: 'community post', channelId: channel.id });
		await post(author, { text: 'quote community', renoteId: note.id });
		expect(await discovery()).toEqual([]);
	});

	test('includes eligible local quotes and renotes', async () => {
		const original = await post(author, { text: 'original' });
		const quote = await post(author, { text: 'quote', renoteId: original.id });
		const renote = await post(author, { renoteId: original.id });
		const notes = await discovery();
		expect(notes.map(n => n.id)).toEqual([renote.id, quote.id, original.id]);
		expect(notes[0].renote?.id).toBe(original.id);
	});

	test('excludes remote embedded content and nested quotes', async () => {
		const remote = await signup({ host: `${randomString()}.example.com` });
		const original = await post(remote, { text: 'remote original' });
		const quote = await post(author, { text: 'local quote of remote', renoteId: original.id });
		await post(author, { renoteId: original.id });
		await post(author, { text: 'nested quote', renoteId: quote.id });
		expect(await discovery()).toEqual([]);
	});

	test('does not expose nonpublic embedded originals', async () => {
		const original = await post(author, { text: 'private original', visibility: 'home' });
		await post(author, { text: 'quote private', renoteId: original.id });
		expect(await discovery()).toEqual([]);
	});

	test.each(['following', 'blocking', 'mute'])('filters embedded authors with %s relationship', async endpoint => {
		const other = await signup();
		const original = await post(other, { text: 'embedded' });
		await post(author, { text: 'quote', renoteId: original.id });
		expect((await api(`${endpoint}/create` as 'following/create', { userId: other.id }, viewer)).status).toBe(endpoint === 'mute' ? 204 : 200);
		expect(await discovery()).toEqual([]);
	});

	test('does not expose deleted originals', async () => {
		const original = await post(author, { text: 'deleted' });
		await post(author, { renoteId: original.id });
		expect((await api('notes/delete', { noteId: original.id }, author)).status).toBe(204);
		expect(await discovery()).toEqual([]);
	});

	test('fills pages after hard word mutes, including embedded CW', async () => {
		await api('i/update', { hardMutedWords: [['hidden']] }, viewer);
		const older = await post(author, { text: 'older eligible' });
		const muted = await post(author, { text: 'original', cw: 'hidden' });
		await post(author, { text: 'quote', renoteId: muted.id });
		const newer = await post(author, { text: 'newer eligible' });
		expect((await discovery({ limit: 2 })).map(n => n.id)).toEqual([newer.id, older.id]);
		expect(await discovery({ untilId: older.id })).toEqual([]);
	});

	test('preserves soft mute controls without suppressing eligible notes', async () => {
		await api('i/update', { mutedWords: [['sensitive']] }, viewer);
		const note = await post(author, { text: 'sensitive' });
		expect((await discovery()).map(n => n.id)).toEqual([note.id]);
	});

	test('orders newest first and paginates across excluded candidates', async () => {
		const followed = await signup();
		await api('following/create', { userId: followed.id }, viewer);
		const first = await post(author, { text: 'first' });
		await post(followed, { text: 'excluded' });
		const second = await post(author, { text: 'second' });
		await post(viewer, { text: 'excluded self' });
		const third = await post(author, { text: 'third' });
		expect((await discovery({ limit: 2 })).map(n => n.id)).toEqual([third.id, second.id]);
		expect((await discovery({ limit: 2, untilId: second.id })).map(n => n.id)).toEqual([first.id]);
		expect(await discovery({ untilId: first.id })).toEqual([]);
		// Native sinceId-only responses are ASC; Paginator reverses for display.
		expect((await discovery({ sinceId: first.id, untilId: undefined, limit: 1 })).map(n => n.id)).toEqual([second.id]);
		expect((await discovery({ sinceId: second.id, untilId: undefined, limit: 1 })).map(n => n.id)).toEqual([third.id]);
	});

	test('rechecks the privacy of an original after a quote was published', async () => {
		const original = await post(author, { text: 'initially public' });
		await post(author, { text: 'public quote', renoteId: original.id });
		const db = await initTestDb(true);
		try {
			await db.getRepository(MiNote).update(original.id, { visibility: 'followers' });
		} finally {
			await db.destroy();
		}
		expect(await discovery()).toEqual([]);
	});

	test('filters incoming blocks and self-authored embedded originals', async () => {
		const other = await signup();
		const original = await post(other, { text: 'blocked original' });
		await post(author, { text: 'quote', renoteId: original.id });
		await post(author, { text: 'quote self', renoteId: anchor.id });
		await api('blocking/create', { userId: viewer.id }, other);
		expect(await discovery()).toEqual([]);
	});

	test('returns a declared error, never false empty, at the defensive scan limit', async () => {
		await api('i/update', { hardMutedWords: [['hidden']] }, viewer);
		const original = await post(author, { text: 'hidden' });
		const db = await initTestDb(true);
		try {
			const repository = db.getRepository(MiNote);
			const template = await repository.findOneByOrFail({ id: original.id });
			const ids = new IdService(loadConfig());
			await repository.insert(Array.from({ length: 1000 }, () => ({ ...template, id: ids.gen() })));
		} finally {
			await db.destroy();
		}
		const res = await api('notes/discovery', { sinceId: anchor.id }, viewer);
		expect(res.status).toBe(400);
		expect(castAsError(res.body as unknown as Record<string, unknown>).error.code).toBe('DISCOVERY_SCAN_LIMIT_EXCEEDED');
	});

	test('empty is true exhaustion and refresh discovers a new post', async () => {
		expect(await discovery()).toEqual([]);
		const note = await post(author, { text: 'new' });
		expect((await discovery()).map(n => n.id)).toEqual([note.id]);
	});
});
