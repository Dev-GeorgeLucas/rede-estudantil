/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { matchedReviewWords, normalizeReviewWords, insertNoteReview } from '@/misc/note-review.js';
import { NoteCreateService } from '@/core/NoteCreateService.js';
import { MiNote } from '@/models/Note.js';
import { MiPoll } from '@/models/Poll.js';
import { MiNoteReview } from '@/models/NoteReview.js';
import { sanitizeServerSettingsLog } from '@/misc/sanitize-server-settings-log.js';
import UpdateMeta, { meta, paramDef } from '@/server/api/endpoints/admin/update-meta.js';
import { meta as readMeta } from '@/server/api/endpoints/admin/meta.js';
import { getValidator } from '../prelude/get-api-validator.js';

const note = { userHost: null, visibility: 'public', text: 'termoalfa!', cw: null } as const;

describe('literal review words', () => {
	test('normalizes both rules and fields with NFKC/case folding, deduplicating and retaining accents', () => {
		const rules = normalizeReviewWords([' TERMOALFA ', '', '  ', 'ｔｅｒｍｏａｌｆａ', 'CAFÉ', 'cafe\u0301']);
		expect(rules).toEqual(['termoalfa', 'café']);
		expect(matchedReviewWords({ ...note, text: 'ＴＥＲＭＯＡＬＦＡ! CAFE\u0301' }, rules)).toEqual(rules);
		expect(matchedReviewWords({ ...note, text: 'cafe' }, ['café'])).toEqual([]);
	});

	test('uses Unicode caseless equivalence for sigma in matching and deduplication', () => {
		const rules = normalizeReviewWords(['ΟΣ', 'οσ', 'ος']);
		expect(rules).toEqual(['ος']);
		expect(matchedReviewWords({ ...note, text: 'οσ' }, rules)).toEqual(rules);
	});

	test.each(['termoalfa!', '(termoalfa)', 'TERMOALFA', 'algo: termoalfa.'])('matches whole words in %s', text => {
		expect(matchedReviewWords({ ...note, text }, ['termoalfa'])).toEqual(['termoalfa']);
	});

	test.each(['supertermoalfa', 'termoalfabeta', '_termoalfa', 'termoalfa2', 'étermoalfa', 'termoalfa\u0301'])('does not match inside a Unicode word: %s', text => {
		expect(matchedReviewWords({ ...note, text }, ['termoalfa'])).toEqual([]);
	});

	test('treats regex metacharacters as literals, never executes a pattern supplied by the administrator', () => {
		expect(matchedReviewWords({ ...note, text: 'a+b' }, normalizeReviewWords(['a+b']))).toEqual(['a+b']);
		expect(matchedReviewWords({ ...note, text: 'aaab' }, normalizeReviewWords(['a+b']))).toEqual([]);
	});

	test.each([['*'], ['termo?'], ['/alfa/i'], ['x\ntermo'], ['x\u0000'], ['x\u200b'], ['a'.repeat(101)], ['ﬃ'.repeat(34)], Array(101).fill('alfa')].map(input => ({ input })))('rejects unsupported or excessive configuration $input', ({ input }) => {
		expect(() => normalizeReviewWords(input)).toThrow(RangeError);
	});

	test('accepts the documented quantity and character limits', () => {
		expect(normalizeReviewWords(Array.from({ length: 100 }, (_, i) => `termo${i}`))).toHaveLength(100);
		expect(normalizeReviewWords(['a'.repeat(100)])).toHaveLength(1);
	});

	test('checks each own field separately and never traverses reply/renote content', () => {
		expect(matchedReviewWords({ ...note, text: 'alfa', cw: 'termo' }, ['termoalfa'], ['termo', 'alfa'])).toEqual([]);
		expect(matchedReviewWords({ ...note, text: 'neutro', cw: null, renote: note, reply: note } as never, ['termoalfa'])).toEqual([]);
		expect(matchedReviewWords({ ...note, text: 'neutro', cw: 'termoalfa' }, ['termoalfa'])).toEqual(['termoalfa']);
		expect(matchedReviewWords({ ...note, text: 'neutro' }, ['termoalfa', 'termobeta'], ['termobeta termoalfa termoalfa'])).toEqual(['termoalfa', 'termobeta']);
	});

	test.each([{ userHost: 'remote.invalid', visibility: 'public' }, { userHost: null, visibility: 'home' }, { userHost: null, visibility: 'followers' }, { userHost: null, visibility: 'specified' }])('checks eligibility before touching content: %j', eligibility => {
		const source = { ...eligibility, get text(): string { throw new Error('Content must not be inspected'); }, get cw(): string { throw new Error('Content must not be inspected'); } };
		expect(matchedReviewWords(source as never, ['termoalfa'])).toEqual([]);
	});

	test('does not inspect content or perform persistence with an empty list', async () => {
		const source = { ...note, get text(): string { throw new Error('Disabled comparator'); } };
		expect(matchedReviewWords(source, [])).toEqual([]);
		const manager = { createQueryBuilder: vi.fn() };
		await insertNoteReview(manager as never, 'fictionalnote', []);
		expect(manager.createQueryBuilder).not.toHaveBeenCalled();
	});
});

describe('administrative configuration', () => {
	test('retains administrator-only read/write permissions and validates request bounds', () => {
		expect(meta).toMatchObject({ requireCredential: true, requireAdmin: true, kind: 'write:admin:meta' });
		expect(readMeta).toMatchObject({ requireCredential: true, requireAdmin: true, kind: 'read:admin:meta' });
		const validate = getValidator(paramDef);
		expect(validate({ reviewWords: ['termoalfa', ''] })).toBe(true);
		expect(validate({ reviewWords: null })).toBe(false);
		expect(validate({ reviewWords: Array(101).fill('alfa') })).toBe(false);
		expect(validate({ reviewWords: ['x'.repeat(101)] })).toBe(false);
	});

	test('updates only the independent list and logs its change without the terms', async () => {
		const before = { reviewWords: ['old-fictional'], sensitiveWords: ['sensitive'], prohibitedWords: ['prohibited'] };
		const after = { ...before, reviewWords: ['termoalfa'] };
		const update = vi.fn().mockResolvedValue(after);
		const fetch = vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after);
		const log = vi.fn();
		const endpoint = new UpdateMeta({} as never, { update, fetch } as never, { log } as never);
		await endpoint.exec({ reviewWords: [' TERMOALFA ', 'termoalfa', ''] }, { id: 'fictionaladmin' } as never, null);
		expect(update).toHaveBeenCalledWith({ reviewWords: ['termoalfa'] });
		expect(log).toHaveBeenCalledWith({ id: 'fictionaladmin' }, 'updateServerSettings', { before: {}, after: {}, changedFields: ['reviewWords'] });
		expect(sanitizeServerSettingsLog({ before, after })).toEqual({ before: {}, after: {}, changedFields: ['reviewWords'] });
	});
});

function insertionSubject(words: string[], fail = false) {
	const builder = { insert: vi.fn().mockReturnThis(), into: vi.fn().mockReturnThis(), values: vi.fn().mockReturnThis(), orIgnore: vi.fn().mockReturnThis(), execute: fail ? vi.fn().mockRejectedValue(new Error('fictional persistence failure')) : vi.fn().mockResolvedValue({}) };
	const manager = { insert: vi.fn().mockResolvedValue({}), createQueryBuilder: () => builder };
	let commit!: () => void;
	const commitGate = new Promise<void>(resolve => { commit = resolve; });
	const transaction = vi.fn(async callback => { await callback(manager); await commitGate; });
	const fastInsert = vi.fn().mockResolvedValue({});
	const notify = vi.fn().mockResolvedValue(undefined);
	const subject = Object.assign(Object.create(NoteCreateService.prototype), {
		noteReviewService: { notify }, meta: { reviewWords: words }, db: { transaction }, notesRepository: { insert: fastInsert }, idService: { gen: () => 'fictionalnote' },
	}) as { insertNote: (user: unknown, data: unknown, tags: string[], emojis: string[], mentions: unknown[]) => Promise<MiNote> };
	return { subject, manager, builder, transaction, fastInsert, commit, notify };
}

describe('note/poll/review commit boundary', () => {
	test.each([false, true])('waits for one transaction, including the poll when present: %s', poll => {
		return (async () => {
			const ctx = insertionSubject(['termoalfa']);
			let returned = false;
			const pending = ctx.subject.insertNote({ id: 'fictionaluser', host: null }, { ...note, poll: poll ? { choices: ['neutro'], expiresAt: null, multiple: false } : null }, [], [], []).then(value => { returned = true; return value; });
			await vi.waitFor(() => expect(ctx.builder.execute).toHaveBeenCalledOnce());
			expect(returned).toBe(false);
			expect(ctx.notify).not.toHaveBeenCalled();
			expect(ctx.manager.insert.mock.calls[0][0]).toBe(MiNote);
			if (poll) expect(ctx.manager.insert.mock.calls[1][0]).toBe(MiPoll);
			expect(ctx.builder.into).toHaveBeenCalledWith(MiNoteReview);
			expect(ctx.builder.values).toHaveBeenCalledWith({ originalNoteId: 'fictionalnote', noteId: 'fictionalnote', matchedWords: ['termoalfa'] });
			expect(ctx.builder.orIgnore).toHaveBeenCalledWith(true);
			expect(ctx.fastInsert).not.toHaveBeenCalled();
			ctx.commit();
			expect((await pending).visibility).toBe('public');
			expect(returned).toBe(true);
			expect(ctx.notify).toHaveBeenCalledWith('noteReviewCreated');
		})();
	});

	test('propagates a case insert failure without returning a published note', async () => {
		const ctx = insertionSubject(['termoalfa'], true);
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			await expect(ctx.subject.insertNote({ id: 'fictionaluser', host: null }, note, [], [], [])).rejects.toThrow('Failed to persist note review');
			expect(ctx.fastInsert).not.toHaveBeenCalled();
		} finally { error.mockRestore(); }
	});

	test('retains the simple path when the list is empty', async () => {
		const ctx = insertionSubject([]);
		await ctx.subject.insertNote({ id: 'fictionaluser', host: null }, note, [], [], []);
		expect(ctx.fastInsert).toHaveBeenCalledOnce();
		expect(ctx.transaction).not.toHaveBeenCalled();
		expect(ctx.builder.execute).not.toHaveBeenCalled();
	});
});
