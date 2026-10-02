/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/vue';
import Explore from '@/pages/explore.vue';
import { Paginator } from '@/utility/paginator.js';

const stream = vi.hoisted(() => ({ on: vi.fn(), dispose: vi.fn() }));
vi.mock('@/stream.js', () => ({ useStream: () => ({ useChannel: () => stream }) }));

vi.mock('@/i.js', () => ({ $i: { id: 'me', policies: {} }, iAmModerator: false }));
vi.mock('@/page.js', () => ({ definePage: vi.fn() }));
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
vi.mock('@/pages/timeline.vue', () => ({ default: { name: 'Following' } }));
vi.mock('@/pages/_loading_.vue', () => ({ default: {} }));
vi.mock('@/pages/_error_.vue', () => ({ default: {} }));

const options = { global: { stubs: { PageWithHeader: {
	props: ['tabs', 'tab', 'actions'], emits: ['update:tab'],
	template: '<div><button v-for="item in tabs" :key="item.key" @click="$emit(\'update:tab\', item.key)">{{ item.key }}</button><button v-for="action in actions" data-testid="reload" @click="action.handler">refresh</button><slot/></div>',
} } } };

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('Explore discovery', () => {
	test.each([undefined, 'featured', 'roles', 'polls', 'unknown'])('opens chronological notes for legacy tab %s', initialTab => {
		const view = render(Explore, { ...options, props: { initialTab } });
		expect(view.getByTestId('feed').textContent).toBe('notes/discovery');
		expect(view.getAllByRole('button').map(button => button.textContent)).toEqual(['notes', 'users', 'refresh']);
		expect(Paginator).toHaveBeenCalledWith('notes/discovery', { limit: 10 });
	});

	test('keeps chronological controls fixed and offers explicit refresh', async () => {
		const view = render(Explore, options);
		expect(view.getByTestId('feed').getAttribute('data-controls')).toBe('false');
		await fireEvent.click(view.getByTestId('reload'));
		expect(vi.mocked(Paginator).mock.results[0].value.reload).toHaveBeenCalledOnce();
	});

	test('reloads after follow changes and disposes its stream subscription', async () => {
		const view = render(Explore, options);
		for (const event of ['follow', 'unfollow']) {
			await stream.on.mock.calls.find(call => call[0] === event)![1]();
		}
		expect(vi.mocked(Paginator).mock.results[0].value.reload).toHaveBeenCalledTimes(2);
		view.unmount();
		expect(stream.dispose).toHaveBeenCalledOnce();
	});

	test('user discovery only requests local accounts and returns to notes', async () => {
		const view = render(Explore, options);
		await fireEvent.click(view.getByRole('button', { name: 'users' }));
		expect(view.getAllByTestId('users').map(node => node.textContent)).toEqual(['local', 'local', 'local']);
		expect(vi.mocked(Paginator).mock.calls.map(call => call[0])).toEqual(['notes/discovery', 'users', 'users', 'users']);
		await fireEvent.click(view.getByRole('button', { name: 'notes' }));
		expect(view.getByTestId('feed').textContent).toBe('notes/discovery');
	});

	test('handles changing hash props without a blank page', async () => {
		const view = render(Explore, { ...options, props: { initialTab: 'users' } });
		expect(view.queryByTestId('feed')).toBeNull();
		await view.rerender({ initialTab: 'roles' });
		expect(view.getByTestId('feed')).not.toBeNull();
	});

	test('guards explore and its timeline alias, preserving admin roles and primary features', async () => {
		const { ROUTE_DEF } = await import('@/router.definition.js');
		for (const path of ['/explore', '/timeline']) {
			const route = ROUTE_DEF.find(route => route.path === path);
			expect(route && 'loginRequired' in route && route.loginRequired).toBe(true);
		}
		const admin = ROUTE_DEF.find(route => route.path === '/admin')!;
		expect(admin.children.some(route => route.path === '/roles')).toBe(true);
		for (const path of ['/', '/my/notifications', '/my/drive', '/channels', '/chat']) {
			expect(ROUTE_DEF.some(route => route.path === path)).toBe(true);
		}
	});
});
