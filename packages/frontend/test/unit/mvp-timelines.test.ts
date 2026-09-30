/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render } from '@testing-library/vue';
import { nextTick } from 'vue';
import { store } from '@/store.js';
import { useStream } from '@/stream.js';
import { Paginator } from '@/utility/paginator.js';
import { updateColumn } from '@/deck.js';
import { availableBasicTimelines, normalizeTimelineSource } from '@/timelines.js';
import Timeline from '@/pages/timeline.vue';
import WidgetTimeline from '@/widgets/WidgetTimeline.vue';
import DeckTimeline from '@/ui/deck/tl-column.vue';
import StreamingTimeline from '@/components/MkStreamingNotesTimeline.vue';

vi.mock('@/i.js', () => ({ $i: { id: 'me', policies: { ltlAvailable: true, gtlAvailable: true } } }));
vi.mock('@/instance.js', () => ({ instance: { policies: { ltlAvailable: true, gtlAvailable: true } } }));
vi.mock('@/store.js', async () => {
	const { reactive, computed } = await import('vue');
	const state = reactive({
		realtimeMode: true,
		tl: { src: 'home', filter: { withRenotes: true, withReplies: false, onlyFiles: false, withSensitive: true } },
	});
	return { store: {
		s: state,
		r: { tl: computed(() => state.tl) },
		set: vi.fn((key: 'tl', value: typeof state.tl) => { state[key] = value; }),
	} };
});
vi.mock('@/preferences.js', async () => {
	const { ref } = await import('vue');
	return { prefer: { s: {}, r: { showFixedPostForm: ref(false) }, model: () => ref(false) } };
});
vi.mock('@/utility/paginator.js', async () => {
	const { ref } = await import('vue');
	return { Paginator: vi.fn(class {
		items = ref([]);
		fetching = ref(false);
		error = ref(null);
		init = vi.fn();
		reload = vi.fn(async () => {});
	}) };
});
vi.mock('@/stream.js', () => {
	const stream = { useChannel: vi.fn(() => ({ on: vi.fn(), dispose: vi.fn() })) };
	return { useStream: () => stream };
});
vi.mock('@/events.js', () => ({ useGlobalEvent: vi.fn(), globalEvents: {} }));
vi.mock('@/utility/sound.js', () => ({}));
vi.mock('@/os.js', () => ({ popupMenu: vi.fn(async () => {}), select: vi.fn() }));
vi.mock('@/router.js', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/page.js', () => ({ definePage: vi.fn() }));
vi.mock('@/deck.js', () => ({ updateColumn: vi.fn() }));
vi.mock('@/ui/deck/tl-note-notification.js', () => ({ soundSettingsButton: vi.fn() }));
vi.mock('@/components/MkNote.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkPostForm.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkButton.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkPullToRefresh.vue', () => ({ default: { template: '<div><slot/></div>' } }));
vi.mock('@/components/MkContainer.vue', () => ({ default: { template: '<div><slot name="header"/><slot/></div>' } }));
vi.mock('@/ui/deck/column.vue', () => ({ default: { template: '<div><slot name="header"/><slot/></div>' } }));

const options = { global: { stubs: { PageWithHeader: { template: '<div><slot/></div>' }, MkTip: true, MkResult: true, MkLoading: true, MkError: true } } };
const hiddenSources = ['local', 'social', 'global'] as const;

function expectFollowingTransport() {
	expect(Paginator).toHaveBeenCalledTimes(1);
	expect(Paginator).toHaveBeenCalledWith('notes/timeline', expect.anything());
	expect(vi.mocked(useStream().useChannel).mock.calls.map(call => call[0])).toEqual(['homeTimeline', 'main']);
}

beforeEach(() => {
	vi.clearAllMocks();
	store.set('tl', { ...store.s.tl, src: 'home' });
});
afterEach(cleanup);

describe('MVP timeline fallback', () => {
	test('only offers Following even when server policies allow public timelines', () => {
		expect(availableBasicTimelines()).toEqual(['home']);
	});

	test.each(hiddenSources)('main page replaces saved %s before its first request', (src) => {
		store.set('tl', { ...store.s.tl, src });
		render(Timeline, options);
		expectFollowingTransport();
		expect(store.s.tl.src).toBe('home');
		expect(store.s.tl.filter.withRenotes).toBe(true);
	});

	test.each(hiddenSources)('a saved %s widget uses Following immediately', (src) => {
		render(WidgetTimeline, { ...options, props: { widget: { id: 'widget', data: { src } } } });
		expectFollowingTransport();
	});

	test.each(hiddenSources)('a saved %s Deck column uses Following and persists the fallback', (tl) => {
		render(DeckTimeline, { ...options, props: { column: { id: 'column', type: 'tl', name: null, width: 330, tl }, isStacked: false } });
		expectFollowingTransport();
		expect(updateColumn).toHaveBeenCalledWith('column', { tl: 'home' });
	});

	test.each(hiddenSources)('a direct %s component source cannot reopen the hidden feed', (src) => {
		render(StreamingTimeline, { ...options, props: { src } });
		expectFollowingTransport();
	});

	test('restoring old main-page settings keeps Following and preserves filters', async () => {
		render(Timeline, options);
		store.set('tl', { ...store.s.tl, src: 'global', filter: { ...store.s.tl.filter, withRenotes: false } });
		await nextTick();
		expect(store.s.tl.src).toBe('home');
		expect(store.s.tl.filter.withRenotes).toBe(false);
		expect(vi.mocked(useStream().useChannel).mock.calls.every(call => ['homeTimeline', 'main'].includes(call[0]))).toBe(true);
	});

	test.each(['list', 'antenna', 'channel', 'mentions', 'directs', 'role', 'list:custom'])('preserves the unrelated %s source', (src) => {
		expect(normalizeTimelineSource(src)).toBe(src);
	});

	test('community timelines still use their own endpoint and channel', () => {
		render(StreamingTimeline, { ...options, props: { src: 'channel', channel: 'community' } });
		expect(Paginator).toHaveBeenCalledWith('channels/timeline', expect.anything());
		expect(useStream().useChannel).toHaveBeenCalledWith('channel', { channelId: 'community' });
	});
});
