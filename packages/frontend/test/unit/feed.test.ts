/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/vue';
import { nextTick } from 'vue';
import { preferState } from '../setup.unit.js';
import type { Router } from '@/router.js';
import { Nirax } from '@/lib/nirax.js';
import { ROUTE_DEF } from '@/router.definition.js';
import { DI } from '@/di.js';
import RouterView from '@/components/global/RouterView.vue';
import MkStickyContainer from '@/components/global/MkStickyContainer.vue';
import PageWithHeader from '@/components/global/PageWithHeader.vue';
import MkPageHeader from '@/components/global/MkPageHeader.vue';
import MobileFooter from '@/ui/_common_/mobile-footer-menu.vue';
import MkA from '@/components/global/MkA.vue';
import { i18n } from '@/i18n.js';
import { isMvpPathVisible } from '@/mvp-visibility.js';

const state = vi.hoisted(() => ({
	visitor: false,
	user: { id: 'me', isAdmin: false, isModerator: false, policies: {} },
	router: null as unknown as Router,
	mounts: { following: vi.fn(), explore: vi.fn(), users: vi.fn() },
	reload: vi.fn(),
}));
vi.mock('@/i.js', () => ({ get $i() { return state.visitor ? null : state.user; }, iAmModerator: false }));
vi.mock('@/router.js', () => ({ useRouter: () => state.router, get mainRouter() { return state.router; } }));
vi.mock('@/page.js', () => ({ definePage: vi.fn() }));
vi.mock('@/os.js', () => ({ __v_isRef: false }));
vi.mock('@/navbar.js', () => ({ navbarItemDef: {} }));
vi.mock('@/accounts.js', () => ({ getAccountMenu: vi.fn() }));
vi.mock('@/pages/_loading_.vue', () => ({ default: { render: () => null } }));
vi.mock('@/pages/_error_.vue', () => ({ default: { render: () => null } }));
vi.mock('@/pages/timeline.following.vue', async () => {
	const { defineComponent, ref } = await import('vue');
	return { __esModule: true, default: defineComponent({
		setup(_, { expose }) {
			state.mounts.following();
			expose({ headerActions: [{ text: 'Refresh following', handler: state.reload }] });
			return { draft: ref('') };
		},
		template: '<div data-testid="following"><input v-model="draft" aria-label="draft"/></div>',
	}) };
});
vi.mock('@/pages/explore.vue', () => ({ __esModule: true, default: {
	setup: () => { state.mounts.explore(); }, template: '<div data-testid="explore">Discovery</div>',
} }));
vi.mock('@/pages/explore.users.vue', () => ({ __esModule: true, default: {
	setup: () => { state.mounts.users(); }, template: '<div data-testid="users">Users</div>',
} }));

function openFeed(path = '/feed') {
	state.router = new Nirax(ROUTE_DEF, path, !state.visitor, { render: () => null }, p => isMvpPathVisible(p));
	state.router.init();
	return render(RouterView, { props: { router: state.router }, global: {
		provide: { [DI.router as symbol]: state.router },
		components: { MkStickyContainer, PageWithHeader, MkPageHeader, MkA, MkAvatar: { render: () => null }, MkUserName: { render: () => null }, MkLoading: { render: () => null } },
		directives: { tooltip: {} },
	} });
}

beforeEach(() => {
	vi.clearAllMocks();
	state.visitor = false;
	state.user.isAdmin = false;
	state.user.isModerator = false;
	preferState.numberOfPageCache = 5;
	preferState.enableHorizontalSwipe = true;
	preferState.showPageTabBarBottom = false;
	vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(cleanup);

describe('Unified Feed', () => {
	test.each(['user', 'moderator', 'admin'])('%s defaults to Following, with three ordered accessible tabs and no unopened requests', async role => {
		state.user.isAdmin = role === 'admin';
		state.user.isModerator = role === 'moderator';
		const view = openFeed('/');
		await view.findByTestId('following');
		expect(state.router.getCurrentFullPath()).toBe('/feed');
		expect(view.getAllByRole('tab').map(tab => tab.textContent?.trim())).toEqual([i18n.ts.following, i18n.ts.explore, i18n.ts.users]);
		expect(view.getByRole('tab', { selected: true }).textContent).toContain(i18n.ts.following);
		expect(view.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(view.getByRole('tab', { selected: true }).id);
		expect(state.mounts.following).toHaveBeenCalledOnce();
		expect(state.mounts.explore).not.toHaveBeenCalled();
		expect(state.mounts.users).not.toHaveBeenCalled();
	});

	test.each([false, true])('lazy tabs preserve content, scroll, header actions and state (bottom tabs: %s)', async bottom => {
		preferState.showPageTabBarBottom = bottom;
		const view = openFeed();
		await view.findByTestId('following');
		const page = view.container.querySelector('._pageScrollable') as HTMLElement;
		await fireEvent.update(view.getByLabelText('draft'), 'saved draft');
		page.scrollTop = 240;
		const pushes = vi.fn();
		state.router.on('push', pushes);
		await fireEvent.click(view.getByRole('tab', { name: i18n.ts.explore }));
		await view.findByTestId('explore');
		expect(state.router.getCurrentFullPath()).toBe('/feed#explore');
		expect(page.scrollTop).toBe(0);
		page.scrollTop = 80;
		await fireEvent.click(view.getByRole('tab', { name: i18n.ts.users }));
		await view.findByTestId('users');
		await fireEvent.click(view.getByRole('tab', { name: i18n.ts.following }));
		await view.findByTestId('following');
		expect(view.container.querySelector('._pageScrollable')).toBe(page);
		expect((view.getByLabelText('draft') as HTMLInputElement).value).toBe('saved draft');
		expect(page.scrollTop).toBe(240);
		// Browser popstate uses replaceByPath: restore the tab without adding another history entry.
		state.router.replaceByPath('/feed#explore');
		await view.findByTestId('explore');
		expect(page.scrollTop).toBe(80);
		expect(pushes).toHaveBeenCalledTimes(3);
		for (const mount of Object.values(state.mounts)) expect(mount).toHaveBeenCalledOnce();
	});

	test.each([false, true])('keyboard navigation activates and focuses tabs in either bar (bottom: %s)', async bottom => {
		preferState.showPageTabBarBottom = bottom;
		const view = openFeed();
		await view.findByTestId('following');
		const first = view.getByRole('tab', { name: i18n.ts.following });
		first.focus();
		await fireEvent.keyDown(first, { key: 'ArrowRight' });
		await view.findByTestId('explore');
		expect(document.activeElement).toBe(view.getByRole('tab', { selected: true }));
		await fireEvent.keyDown(document.activeElement!, { key: 'End' });
		await view.findByTestId('users');
		await fireEvent.keyDown(document.activeElement!, { key: 'Home' });
		await view.findByTestId('following');
		expect(view.getAllByRole('tab').map(tab => tab.tabIndex)).toEqual([0, -1, -1]);
	});

	test.each([
		['/feed#following', 'following'], ['/feed#explore', 'explore'], ['/feed#users', 'users'],
		['/explore', 'explore'], ['/explore#notes', 'explore'], ['/explore#users', 'users'],
		['/explore#featured', 'explore'], ['/explore#roles', 'explore'], ['/timeline', 'following'],
	])('direct entry/reload %s resolves to %s without an independent page', async (path, expected) => {
		const view = openFeed(path);
		await view.findByTestId(expected);
		expect(state.router.current.route.path).toBe('/feed');
		expect(Object.values(state.mounts).reduce((n, fn) => n + fn.mock.calls.length, 0)).toBe(1);
	});

	test.each(['/feed', '/feed#following', '/feed#explore', '/feed#users', '/explore', '/explore#users', '/timeline'])('visitor at %s only mounts public users', async path => {
		state.visitor = true;
		const view = openFeed(path);
		await view.findByTestId('users');
		expect(view.getAllByRole('tab').map(tab => tab.textContent?.trim())).toEqual([i18n.ts.users]);
		expect(state.mounts.following).not.toHaveBeenCalled();
		expect(state.mounts.explore).not.toHaveBeenCalled();
	});

	test('Feed link remains active across tabs and leaving the page reuses a single cache entry', async () => {
		const view = openFeed('/feed#users');
		await view.findByTestId('users');
		const link = render(MkA, { props: { to: '/feed', activeClass: 'active' } });
		const footer = render(MobileFooter, { global: { directives: { tooltip: {} } } });
		for (const tab of ['following', 'explore', 'users']) {
			state.router.pushByPath(`/feed#${tab}`);
			await view.findByTestId(tab);
			expect(link.getByRole('link').classList.contains('active')).toBe(true);
			expect(footer.getByRole('button', { name: i18n.ts.timeline }).getAttribute('aria-current')).toBe('page');
		}
		const scroller = view.container.querySelector('._pageScrollable') as HTMLElement;
		scroller.scrollTop = 430;
		// A blocked route is a cheap second page, preserving existing MVP restrictions.
		state.router.pushByPath('/play');
		await nextTick();
		expect(link.getByRole('link').classList.contains('active')).toBe(false);
		state.router.pushByPath('/feed#following');
		await view.findByTestId('following');
		await new Promise(resolve => window.setTimeout(resolve, 150));
		expect(scroller.scrollTop).toBe(0);
		await waitFor(() => expect(state.mounts.following).toHaveBeenCalledOnce());
		for (const mount of Object.values(state.mounts)) expect(mount).toHaveBeenCalledOnce();
	});
});
