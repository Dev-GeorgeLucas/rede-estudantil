/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { computed, ref } from 'vue';
import type { entities } from 'misskey-js';
import { isFeedNote } from '@/utility/feed-notes.js';
import { Paginator } from '@/utility/paginator.js';
import { misskeyApi } from '@/utility/misskey-api.js';

vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const note = (id: string, props: Partial<entities.Note> = {}) => ({ id, createdAt: '2026-10-22T00:00:00Z', replyId: null, renoteId: null, text: 'Post', ...props }) as entities.Note;
const reply = (id: string, userId = 'other') => note(id, { replyId: 'parent', userId });

test.each([
	['original', note('1'), true],
	['original with mention', note('1', { text: '@someone hello' }), true],
	['own reply', reply('1', 'me'), false],
	['followed user reply', reply('1', 'following'), false],
	['other user reply', reply('1'), false],
	['orphan reply without embedded parent', note('1', { replyId: 'missing', reply: undefined }), false],
	['orphan reply with null parent', note('1', { replyId: 'missing', reply: null }), false],
	['renote of orphan reply', note('1', { renoteId: '2', renote: note('2', { replyId: 'missing', reply: null }) }), false],
	['renote of reply', note('1', { renoteId: '2', renote: reply('2'), text: null }), false],
	['nested renote of reply', note('1', { renote: note('2', { renote: reply('3') }) }), false],
	['renote of original', note('1', { renoteId: '2', renote: note('2'), text: null }), true],
	['quote of original', note('1', { renoteId: '2', renote: note('2'), text: 'comment' }), true],
])('%s respects the Feed policy', (_label, item, eligible) => {
	expect(isFeedNote(item)).toBe(eligible);
});

describe.each(['notes/timeline', 'notes/discovery'] as const)('%s filtered pagination', endpoint => {
	const create = () => new Paginator(endpoint, { itemFilter: isFeedNote });
	test('initial replies-only pages continue with the original raw cursor', async () => {
		vi.mocked(misskeyApi).mockResolvedValueOnce([reply('z', 'me'), reply('y')]).mockResolvedValueOnce([note('x'), reply('w')]).mockResolvedValueOnce([note('v')]);
		const paginator = create();
		await paginator.init();
		expect(misskeyApi).toHaveBeenNthCalledWith(2, endpoint, expect.objectContaining({ untilId: 'y' }));
		expect(paginator.items.value.map(x => x.id)).toEqual(['x']);
		await paginator.fetchOlder();
		expect(misskeyApi).toHaveBeenLastCalledWith(endpoint, expect.objectContaining({ untilId: 'w' }));
		expect(paginator.items.value.map(x => x.id)).toEqual(['x', 'v']);
	});

	test('a later replies-only page does not end pagination', async () => {
		vi.mocked(misskeyApi).mockResolvedValueOnce([note('z')]).mockResolvedValueOnce([reply('y')]).mockResolvedValueOnce([reply('x')]).mockResolvedValueOnce([note('w')]).mockResolvedValueOnce([]);
		const paginator = create();
		await paginator.init();
		await paginator.fetchOlder();
		expect(paginator.items.value.map(x => x.id)).toEqual(['z', 'w']);
		expect(paginator.canFetchOlder.value).toBe(true);
		await paginator.fetchOlder();
		expect(paginator.canFetchOlder.value).toBe(false);
	});

	test('bounds scanning, keeps continuation available even with zero visible items', async () => {
		for (const id of ['z', 'y', 'x', 'w', 'v']) vi.mocked(misskeyApi).mockResolvedValueOnce([reply(id)]);
		vi.mocked(misskeyApi).mockResolvedValueOnce([note('u')]);
		const paginator = create();
		await paginator.init();
		expect(misskeyApi).toHaveBeenCalledTimes(5);
		expect(paginator.autoFetchPaused.value).toBe(true);
		expect(paginator.items.value).toEqual([]);
		expect(paginator.canFetchOlder.value).toBe(true);
		await paginator.fetchOlder();
		expect(misskeyApi).toHaveBeenLastCalledWith(endpoint, expect.objectContaining({ untilId: 'v' }));
		expect(paginator.items.value.map(x => x.id)).toEqual(['u']);
		expect(paginator.autoFetchPaused.value).toBe(false);
	});

	test('only reports a truly empty feed after the API is exhausted', async () => {
		vi.mocked(misskeyApi).mockResolvedValueOnce([reply('z')]).mockResolvedValueOnce([]);
		const paginator = create();
		await paginator.init();
		expect(paginator.items.value).toEqual([]);
		expect(paginator.canFetchOlder.value).toBe(false);
	});

	test('filters live inserts, own submissions and queued items without dropping originals', () => {
		const paginator = create();
		paginator.prepend(reply('z', 'me'));
		paginator.prepend(reply('y'));
		paginator.enqueue(note('x', { renote: reply('w') }));
		expect(paginator.queuedAheadItemsCount.value).toBe(0);
		paginator.enqueue(note('v', { text: '@someone' }));
		paginator.releaseQueue();
		expect(paginator.items.value.map(x => x.id)).toEqual(['v']);
	});

	test('purges preexisting cached replies before rendering and keeps their cursor', async () => {
		vi.mocked(misskeyApi).mockResolvedValueOnce([note('z')]).mockResolvedValueOnce([note('v')]);
		const paginator = create();
		await paginator.init();
		paginator.items.value.push(reply('w'));
		paginator.filterCachedItems();
		expect(paginator.items.value.map(x => x.id)).toEqual(['z']);
		await paginator.fetchOlder();
		expect(misskeyApi).toHaveBeenLastCalledWith(endpoint, expect.objectContaining({ untilId: 'w' }));
	});

	test('polling excludes replies from both the queue and rendered list, advances sinceId', async () => {
		vi.mocked(misskeyApi).mockResolvedValueOnce([note('a')]).mockResolvedValueOnce([reply('b')]).mockResolvedValueOnce([note('c'), reply('d')]).mockResolvedValueOnce([note('e')]);
		const paginator = create();
		await paginator.init();
		await paginator.fetchNewer({ toQueue: true });
		expect(paginator.queuedAheadItemsCount.value).toBe(1);
		paginator.releaseQueue();
		await paginator.fetchNewer();
		expect(misskeyApi).toHaveBeenLastCalledWith(endpoint, expect.objectContaining({ sinceId: 'd' }));
		expect(paginator.items.value.map(x => x.id)).toEqual(['e', 'c', 'a']);
	});

	test('does not issue duplicate concurrent requests', async () => {
		let resolve!: (value: entities.Note[]) => void;
		vi.mocked(misskeyApi).mockReturnValueOnce(new Promise<entities.Note[]>(r => { resolve = r; }));
		const paginator = create();
		const initial = paginator.init();
		const repeated = paginator.init();
		await paginator.fetchNewer();
		resolve([note('z')]);
		await Promise.all([initial, repeated]);
		expect(misskeyApi).toHaveBeenCalledTimes(1);
		vi.mocked(misskeyApi).mockReturnValueOnce(new Promise<entities.Note[]>(r => { resolve = r; }));
		const older = paginator.fetchOlder();
		await Promise.all([paginator.fetchOlder(), paginator.fetchNewer()]);
		resolve([note('y')]);
		await older;
		expect(misskeyApi).toHaveBeenCalledTimes(2);
	});

	test('keeps pagination retryable after a network error', async () => {
		vi.mocked(misskeyApi).mockResolvedValueOnce([note('z')]).mockResolvedValueOnce([reply('y')]).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([note('x')]);
		const paginator = create();
		await paginator.init();
		await paginator.fetchOlder();
		expect(paginator.canFetchOlder.value).toBe(true);
		await paginator.fetchOlder();
		expect(paginator.items.value.map(x => x.id)).toEqual(['z', 'x']);
	});

	test('stops repeated raw pages without an endless scan', async () => {
		vi.mocked(misskeyApi).mockResolvedValue([reply('z')]);
		const paginator = create();
		await paginator.init();
		expect(misskeyApi).toHaveBeenCalledTimes(2);
		expect(paginator.autoFetchPaused.value).toBe(true);
		expect(paginator.canFetchOlder.value).toBe(true);
	});

	test('trimming live inserts keeps dropped originals reachable', async () => {
		const originals = Array.from({ length: 31 }, (_, i) => note(String(90 - i)));
		vi.mocked(misskeyApi).mockResolvedValueOnce([...originals, reply('10')]).mockResolvedValueOnce([note('61'), note('60')]);
		const paginator = create();
		await paginator.init();
		paginator.prepend(note('99'));
		await paginator.fetchOlder();
		expect(misskeyApi).toHaveBeenLastCalledWith(endpoint, expect.objectContaining({ untilId: '62' }));
		expect(paginator.items.value.map(x => x.id)).toContain('60');
	});
});

test('unfiltered conversations and profile queries continue to include replies', async () => {
	vi.mocked(misskeyApi).mockResolvedValueOnce([reply('z')]);
	const paginator = new Paginator('notes/children', { params: { noteId: 'parent' } });
	await paginator.init();
	paginator.prepend(reply('y', 'me'));
	paginator.prepend(reply('y', 'me'));
	expect(paginator.items.value.map(x => x.id)).toEqual(['y', 'z']);
});

test('changing query while initialization is pending fetches the latest filter', async () => {
	const withFiles = ref(false);
	let resolve!: (value: entities.Note[]) => void;
	vi.mocked(misskeyApi).mockReturnValueOnce(new Promise<entities.Note[]>(r => { resolve = r; })).mockResolvedValueOnce([note('b')]);
	const paginator = new Paginator('notes/timeline', { computedParams: computed(() => ({ withFiles: withFiles.value })) });
	const first = paginator.init();
	withFiles.value = true;
	const changed = paginator.reload();
	resolve([note('a')]);
	await Promise.all([first, changed]);
	expect(misskeyApi).toHaveBeenCalledTimes(2);
	expect(misskeyApi).toHaveBeenLastCalledWith('notes/timeline', expect.objectContaining({ withFiles: true }));
	expect(paginator.items.value.map(x => x.id)).toEqual(['b']);
});

test('reload waits for older pagination instead of mixing two result sets', async () => {
	let resolve!: (value: entities.Note[]) => void;
	vi.mocked(misskeyApi).mockResolvedValueOnce([note('z')]).mockReturnValueOnce(new Promise<entities.Note[]>(r => { resolve = r; })).mockResolvedValueOnce([note('new')]);
	const paginator = new Paginator('notes/timeline', { itemFilter: isFeedNote });
	await paginator.init();
	const older = paginator.fetchOlder();
	const reload = paginator.reload();
	expect(misskeyApi).toHaveBeenCalledTimes(2);
	resolve([note('y')]);
	await Promise.all([older, reload]);
	expect(paginator.items.value.map(x => x.id)).toEqual(['new']);
});
