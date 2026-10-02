/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import { collectDiscoveryNotes, DiscoveryScanLimitError } from '@/misc/collect-discovery-notes.js';

function source(count: number) {
	const notes = Array.from({ length: count }, (_, i) => ({ id: String(i + 1) }));
	return vi.fn(async (cursor: string | undefined, limit: number) => notes.slice(Number(cursor ?? 0), Number(cursor ?? 0) + limit));
}

describe('discovery scan', () => {
	test('continues past completely filtered batches', async () => {
		const fetch = source(205);
		const result = await collectDiscoveryNotes(fetch, async note => Number(note.id) > 200, 3);
		expect(result.map(note => note.id)).toEqual(['201', '202', '203']);
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	test('returns true empty only after exhaustion', async () => {
		const fetch = source(100);
		expect(await collectDiscoveryNotes(fetch, async () => false, 10)).toEqual([]);
		expect(fetch).toHaveBeenLastCalledWith('100', 100);
	});

	test('a bounded scan never returns false empty', async () => {
		const fetch = source(201);
		await expect(collectDiscoveryNotes(fetch, async () => false, 10, 200)).rejects.toBeInstanceOf(DiscoveryScanLimitError);
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	test('partial pages keep a usable cursor at the scan budget', async () => {
		const fetch = source(300);
		expect(await collectDiscoveryNotes(fetch, async note => note.id === '120', 10, 200)).toEqual([{ id: '120' }]);
	});

	test('does not turn a failed query into exhaustion', async () => {
		await expect(collectDiscoveryNotes(async () => { throw new Error('query failed'); }, async () => true, 10)).rejects.toThrow('query failed');
	});
});
