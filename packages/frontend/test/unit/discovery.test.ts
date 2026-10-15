/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/vue';
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue';
import Explore from '@/pages/explore.vue';
import Users from '@/pages/explore.users.vue';
import { Paginator } from '@/utility/paginator.js';

const stream = vi.hoisted(() => ({ on: vi.fn(), dispose: vi.fn() }));
vi.mock('@/stream.js', () => ({ useStream: () => ({ useChannel: () => stream }) }));
vi.mock('@/utility/paginator.js', () => ({
	Paginator: vi.fn(class {
		reload = vi.fn(async () => {});
		constructor(public endpoint: string, public options: { params?: { origin?: string } }) {}
	}),
}));
vi.mock('@/components/MkNotesTimeline.vue', () => ({ default: {
	props: ['paginator', 'withControl'], template: '<div data-testid="feed" :data-controls="withControl">{{ paginator.endpoint }}</div>',
} }));
vi.mock('@/components/MkUserList.vue', () => ({ default: {
	props: ['paginator'], template: '<div data-testid="users">{{ paginator.options.params.origin }}</div>',
} }));
vi.mock('@/components/MkFoldableSection.vue', () => ({ default: { template: '<section><slot/></section>' } }));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('Feed discovery content', () => {
	test('keeps the discovery paginator, fixed chronological controls and refresh action', async () => {
		const view = render(defineComponent({ components: { Explore }, template: '<Explore ref="content"/><button @click="$refs.content.headerActions[0].handler()">refresh</button>' }));
		expect(view.getByTestId('feed').textContent).toBe('notes/discovery');
		expect(view.getByTestId('feed').getAttribute('data-controls')).toBe('false');
		expect(Paginator).toHaveBeenCalledWith('notes/discovery', { limit: 10 });
		await fireEvent.click(view.getByRole('button', { name: 'refresh' }));
		expect(vi.mocked(Paginator).mock.results[0].value.reload).toHaveBeenCalledOnce();
		view.unmount();
	});

	test('reloads active discovery after follow changes; defers hidden refresh without new subscriptions', async () => {
		const visible = ref(true);
		const view = render(defineComponent({ setup: () => () => h(KeepAlive, () => visible.value ? h(Explore) : h('div')) }));
		const reload = vi.mocked(Paginator).mock.results[0].value.reload;
		const follow = stream.on.mock.calls.find(call => call[0] === 'follow')![1];
		const unfollow = stream.on.mock.calls.find(call => call[0] === 'unfollow')![1];
		follow();
		expect(reload).toHaveBeenCalledOnce();
		visible.value = false;
		await nextTick();
		follow();
		unfollow();
		expect(reload).toHaveBeenCalledOnce();
		visible.value = true;
		await nextTick();
		expect(reload).toHaveBeenCalledTimes(2);
		expect(Paginator).toHaveBeenCalledOnce();
		expect(stream.on).toHaveBeenCalledTimes(2);
		view.unmount();
		expect(stream.dispose).toHaveBeenCalledOnce();
	});

	test('preserves the three local user lists and their existing filters', () => {
		const view = render(Users);
		expect(view.getAllByTestId('users').map(node => node.textContent)).toEqual(['local', 'local', 'local']);
		for (const [sort, state] of [['+follower', 'alive'], ['+updatedAt', undefined], ['+createdAt', 'alive']]) {
			expect(Paginator).toHaveBeenCalledWith('users', expect.objectContaining({ limit: 10, noPaging: true, params: expect.objectContaining({ origin: 'local', sort, ...(state ? { state } : {}) }) }));
		}
	});
});
