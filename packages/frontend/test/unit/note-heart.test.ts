/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { heartCount, isHeartReaction, toggleNoteHeart, toggleNoteReaction } from '@/utility/note-heart.js';

function actions(reaction: string | null = null) {
	return { current: () => reaction, confirm: vi.fn(async () => true), create: vi.fn(async () => {}), remove: vi.fn(async () => {}), reconcile: vi.fn(async () => {}) };
}

describe('note heart', () => {
	test('recognizes the same local custom emoji in picker and captured state', async () => {
		const a = actions(':wave@.:');
		await toggleNoteReaction('a', a, ':wave:');
		expect(a.remove).toHaveBeenCalledTimes(1);
		expect(a.confirm).not.toHaveBeenCalled();
		expect(a.create).not.toHaveBeenCalled();
	});
	test('counts only canonical hearts, including presentation variants', () => {
		expect(heartCount({ '❤': 2, '❤️': 3, '👍': 8, ':heart:': 4 })).toBe(5);
		expect(isHeartReaction('❤️')).toBe(true);
		expect(isHeartReaction(null)).toBe(false);
	});
	test('creates a heart and reconciles', async () => {
		const a = actions();
		await toggleNoteHeart('a', a);
		expect(a.create).toHaveBeenCalledTimes(1);
		expect(a.remove).not.toHaveBeenCalled();
		expect(a.reconcile).toHaveBeenCalledTimes(1);
	});
	test.each(['❤', '❤️'])('removes %s', async reaction => {
		const a = actions(reaction);
		await toggleNoteHeart('a', a);
		expect(a.remove).toHaveBeenCalledTimes(1);
		expect(a.create).not.toHaveBeenCalled();
	});
	test('cancel leaves the previous emoji untouched', async () => {
		const a = actions('👍');
		a.confirm.mockResolvedValue(false);
		await toggleNoteHeart('a', a);
		expect(a.create).not.toHaveBeenCalled();
		expect(a.remove).not.toHaveBeenCalled();
	});
	test('waits for confirmation and replaces through create only', async () => {
		const a = actions('👍');
		let confirm!: (value: boolean) => void;
		a.confirm.mockImplementation(() => new Promise(resolve => { confirm = resolve; }));
		const task = toggleNoteHeart('a', a);
		expect(a.create).not.toHaveBeenCalled();
		expect(a.remove).not.toHaveBeenCalled();
		confirm(true);
		await task;
		expect(a.create).toHaveBeenCalledTimes(1);
		expect(a.remove).not.toHaveBeenCalled();
	});
	test('repeated clicks across rendered copies issue one request', async () => {
		const a = actions();
		let finish!: () => void;
		a.create.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
		const first = toggleNoteHeart('a', a);
		await toggleNoteHeart('a', a);
		expect(a.create).toHaveBeenCalledTimes(1);
		finish();
		await first;
	});
	test('network failures reconcile and release the lock for retry', async () => {
		const a = actions('👍');
		a.create.mockRejectedValueOnce(new Error('network'));
		await expect(toggleNoteHeart('a', a)).rejects.toThrow('network');
		expect(a.reconcile).toHaveBeenCalledTimes(1);
		expect(a.remove).not.toHaveBeenCalled();
		await toggleNoteHeart('a', a);
		expect(a.create).toHaveBeenCalledTimes(2);
	});
});
