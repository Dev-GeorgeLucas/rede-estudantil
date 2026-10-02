/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { entities } from 'misskey-js';
import { Paginator } from '@/utility/paginator.js';
import { misskeyApi } from '@/utility/misskey-api.js';

vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const note = (id: string) => ({ id, createdAt: '2026-09-30T00:00:00Z' }) as entities.Note;

describe('Discovery with the native paginator', () => {
	test('keeps partial pages pageable and uses the last returned ID', async () => {
		vi.mocked(misskeyApi).mockResolvedValueOnce([note('c'), note('b')]).mockResolvedValueOnce([note('a')]).mockResolvedValueOnce([]);
		const paginator = new Paginator('notes/discovery', { limit: 10 });
		await paginator.init();
		expect(paginator.canFetchOlder.value).toBe(true);
		await paginator.fetchOlder();
		expect(misskeyApi).toHaveBeenLastCalledWith('notes/discovery', expect.objectContaining({ untilId: 'b' }));
		expect(paginator.items.value.map(n => n.id)).toEqual(['c', 'b', 'a']);
		await paginator.fetchOlder();
		expect(paginator.canFetchOlder.value).toBe(false);
	});

	test('renders sinceId results newest first', async () => {
		vi.mocked(misskeyApi).mockResolvedValueOnce([note('a')]).mockResolvedValueOnce([note('b'), note('c')]);
		const paginator = new Paginator('notes/discovery', { limit: 10 });
		await paginator.init();
		await paginator.fetchNewer();
		expect(misskeyApi).toHaveBeenLastCalledWith('notes/discovery', expect.objectContaining({ sinceId: 'a' }));
		expect(paginator.items.value.map(n => n.id)).toEqual(['c', 'b', 'a']);
	});

	test('distinguishes scan errors from true empty and supports retry', async () => {
		vi.mocked(misskeyApi).mockRejectedValueOnce({ code: 'DISCOVERY_SCAN_LIMIT_EXCEEDED' }).mockResolvedValueOnce([]).mockResolvedValueOnce([note('a')]);
		const paginator = new Paginator('notes/discovery', { limit: 10 });
		await paginator.init();
		expect(paginator.error.value).toBe(true);
		await paginator.reload();
		expect(paginator.error.value).toBe(false);
		expect(paginator.items.value).toEqual([]);
		expect(paginator.canFetchOlder.value).toBe(false);
		await paginator.reload();
		expect(paginator.items.value.map(n => n.id)).toEqual(['a']);
	});

	test('does not mark a failed older-page request as the end', async () => {
		vi.mocked(misskeyApi).mockResolvedValueOnce([note('b')]).mockRejectedValueOnce({ code: 'DISCOVERY_SCAN_LIMIT_EXCEEDED' }).mockResolvedValueOnce([note('a')]);
		const paginator = new Paginator('notes/discovery', { limit: 10 });
		await paginator.init();
		await paginator.fetchOlder();
		expect(paginator.canFetchOlder.value).toBe(true);
		await paginator.fetchOlder();
		expect(paginator.items.value.map(n => n.id)).toEqual(['b', 'a']);
	});
});
