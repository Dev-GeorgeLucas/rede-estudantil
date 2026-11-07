/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { NoteReviewService } from '@/core/NoteReviewService.js';
import { MiNoteReview } from '@/models/NoteReview.js';
import { meta as listMeta, paramDef as listParams } from '@/server/api/endpoints/admin/note-reviews.js';
import { meta as resolveMeta, paramDef as resolveParams } from '@/server/api/endpoints/admin/resolve-note-review.js';
import { getValidator } from '../prelude/get-api-validator.js';

function setup(state = 'pending') {
	const review = Object.assign(new MiNoteReview(), { originalNoteId: 'fictionalnote', noteId: null, matchedWords: ['termoalfa'], createdAt: new Date(0), state, resolvedAt: null, resolvedById: null, resolution: null });
	const repository = { findOne: vi.fn().mockResolvedValue(review), update: vi.fn() };
	const manager = { getRepository: vi.fn().mockReturnValue(repository) };
	let commit!: () => void;
	const committed = new Promise<void>(resolve => { commit = resolve; });
	const db = { transaction: vi.fn(async callback => { const result = await callback(manager); await committed; return result; }) };
	const log = vi.fn();
	const moderators = vi.fn().mockResolvedValue(['fakeadmin', 'fakemod']);
	const publish = vi.fn();
	const service = new NoteReviewService(db as never, { log } as never, { getModeratorIds: moderators } as never, { publishAdminStream: publish } as never);
	return { service, review, repository, manager, log, publish, commit, moderators };
}

describe('note review resolution', () => {
	test('serializes the decision and writes a minimal audit through the same manager before commit', async () => {
		const ctx = setup();
		const pending = ctx.service.resolve('fictionalnote', { id: 'fakemod' }, 'falsePositive');
		await vi.waitFor(() => expect(ctx.log).toHaveBeenCalledOnce());
		expect(ctx.repository.findOne).toHaveBeenCalledWith({ where: { originalNoteId: 'fictionalnote' }, lock: { mode: 'pessimistic_write' } });
		expect(ctx.log).toHaveBeenCalledWith({ id: 'fakemod' }, 'resolveNoteReview', { caseId: 'fictionalnote', resolvedAt: expect.any(String), resolution: 'falsePositive' }, ctx.manager);
		expect(JSON.stringify(ctx.log.mock.calls)).not.toContain('termoalfa');
		expect(ctx.publish).not.toHaveBeenCalled();
		ctx.commit();
		expect(await pending).toMatchObject({ state: 'resolved', resolvedById: 'fakemod', resolution: 'falsePositive', alreadyResolved: false });
		expect(ctx.moderators).toHaveBeenCalledWith({ includeAdmins: true, includeRoot: true, excludeExpire: true });
		expect(ctx.publish).toHaveBeenCalledWith('fakemod', 'noteReviewResolved', {});
	});

	test('returns a previous decision without changing attribution, logging or emitting again', async () => {
		const ctx = setup('resolved');
		Object.assign(ctx.review, { resolvedById: 'firstmod', resolution: 'reviewed', resolvedAt: new Date(42) });
		ctx.commit();
		expect(await ctx.service.resolve('fictionalnote', { id: 'secondmod' }, 'unavailable')).toMatchObject({ resolvedById: 'firstmod', resolution: 'reviewed', alreadyResolved: true });
		expect(ctx.repository.update).not.toHaveBeenCalled();
		expect(ctx.log).not.toHaveBeenCalled();
		expect(ctx.publish).not.toHaveBeenCalled();
	});

	test('propagates an audit failure and never emits a resolution event', async () => {
		const ctx = setup();
		ctx.log.mockRejectedValueOnce(new Error('audit write failed'));
		await expect(ctx.service.resolve('fictionalnote', { id: 'fakemod' }, 'reviewed')).rejects.toThrow('audit write failed');
		expect(ctx.publish).not.toHaveBeenCalled();
	});

	test('returns absence without recording a decision', async () => {
		const ctx = setup(); ctx.repository.findOne.mockResolvedValue(null); ctx.commit();
		expect(await ctx.service.resolve('fictionalnote', { id: 'fakemod' }, 'reviewed')).toBeNull();
		expect(ctx.log).not.toHaveBeenCalled();
	});

	test('uses the existing administrative read/write scopes and moderator authorization', () => {
		expect(listMeta).toMatchObject({ requireCredential: true, requireModerator: true, kind: 'read:admin:abuse-user-reports' });
		expect(resolveMeta).toMatchObject({ requireCredential: true, requireModerator: true, kind: 'write:admin:resolve-abuse-user-report' });
	});

	test.each([{ limit: 0 }, { limit: 101 }, { state: 'unknown' }, { untilId: 'invalid-id' }, { caseIds: [] }, { caseIds: Array(101).fill('aidx000000000001') }, { caseIds: ['aidx000000000001', 'aidx000000000001'] }])('rejects invalid list parameters %j', input => {
		expect(getValidator(listParams)(input)).toBe(false);
	});

	test('requires an explicit supported decision', () => {
		const validate = getValidator(resolveParams);
		for (const resolution of ['falsePositive', 'reviewed', 'unavailable']) expect(validate({ caseId: 'aidx000000000001', resolution })).toBe(true);
		for (const input of [{ caseId: 'aidx000000000001' }, { caseId: 'aidx000000000001', resolution: 'punish' }, { caseId: 'aidx000000000001', resolution: null }]) expect(validate(input)).toBe(false);
	});
});
