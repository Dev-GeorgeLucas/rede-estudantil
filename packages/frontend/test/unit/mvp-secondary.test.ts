/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/vue';
import { ref } from 'vue';
import { preferReactive } from '../setup.unit.js';
import { filterMvpSearchIndex, getMvpUi, isMvpPathVisible } from '@/mvp-visibility.js';
import { searchIndexes } from 'search-index:settings';
import { genSearchIndexes } from '@/utility/inapp-search.js';
import UserProfile from '@/pages/user/index.vue';
import Statusbars from '@/ui/_common_/statusbars.vue';

const session = vi.hoisted(() => ({ user: null as null | { isAdmin: boolean; isModerator: boolean; policies: { chatAvailability: string } }, api: vi.fn(), execute: vi.fn() }));
vi.mock('@/i.js', () => ({
	get $i() { return session.user; },
	get iAmModerator() { return !!(session.user?.isAdmin || session.user?.isModerator); },
}));
vi.mock('@/analytics.js', () => ({ analytics: { page: vi.fn() } }));
vi.mock('@/page.js', () => ({ definePage: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: session.api }));
vi.mock('@/instance.js', () => ({ instance: { federation: 'all' } }));
vi.mock('@/server-context.js', () => ({ serverContext: null, assertServerContext: () => false }));
vi.mock('@/pages/user/home.vue', () => ({ __esModule: true, default: { template: '<div>Profile</div>' } }));
vi.mock('@/pages/timeline.vue', () => ({ __esModule: true, default: { name: 'Following' } }));
vi.mock('@/pages/_loading_.vue', () => ({ __esModule: true, default: {} }));
vi.mock('@/pages/_error_.vue', () => ({ __esModule: true, default: {} }));
vi.mock('@/pages/not-found.vue', () => ({ __esModule: true, default: { name: 'NotFound', template: '<div>Not found</div>' } }));
// These stand-ins execute on mount, just as saved Play/RSS content would.
vi.mock('@/pages/flash/flash.vue', () => ({ __esModule: true, default: { setup: session.execute, template: '<div>Play</div>' } }));
vi.mock('@/ui/_common_/statusbar-rss.vue', () => ({ __esModule: true, default: { setup: session.execute, template: '<div>RSS</div>' } }));

const roles = ['visitor', 'user', 'moderator', 'admin'] as const;
function setRole(role: typeof roles[number]) {
	session.user = role === 'visitor' ? null : { isAdmin: role === 'admin', isModerator: role === 'moderator', policies: { chatAvailability: 'available' } };
}

const blocked = [
	'/my/antennas', '/my/antennas/create', '/my/antennas/existing', '/timeline/antenna/existing',
	'/pages', '/pages/new', '/pages/edit/existing', '/@student/pages/saved', '/@student/pages',
	'/play', '/play/new', '/play/saved', '/play/saved/edit', '/@student/flashs', '/@student/play',
	'/gallery', '/gallery/new', '/gallery/saved', '/gallery/saved/edit', '/@student/gallery',
	'/settings/statusbar', '/settings/deck', '/@student@remote.test/pages', '/@student/%66lashs',
];
const kept = ['/', '/explore', '/chat', '/channels', '/announcements', '/my/notifications', '/my/drive', '/my/lists', '/my/favorites', '/my/clips', '/settings', '/admin', '/admin/abuses', '/oauth/authorize', '/miauth/session', '/share'];

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('MVP secondary features', () => {
	test.each(roles)('%s: initial load, windows, navigation and URL variants resolve to standard not-found', async role => {
		setRole(role);
		const { createRouter } = await import('@/router.js');
		for (const path of blocked.flatMap(path => [path, `${path}/?from=backup#saved`])) {
			expect(isMvpPathVisible(path), path).toBe(false);
			const router = createRouter(path);
			router.init();
			const route = router.current.route;
			expect('component' in route).toBe(true);
			if ('component' in route) {
				const component = await (route.component as { __asyncLoader: () => Promise<{ name: string }> }).__asyncLoader();
				expect(component.name, path).toBe('NotFound');
			}
			router.push('/');
			router.pushByPath(path);
			expect(router.current.child).toBeUndefined();
			expect(router.current.props.size).toBe(0);
		}
		for (const path of kept) expect(isMvpPathVisible(path), path).toBe(true);
		expect(session.api).not.toHaveBeenCalled();
		expect(session.execute).not.toHaveBeenCalled();
	});

	test.each(roles)('%s: profile tabs retain core features and omit secondary content', async role => {
		setRole(role);
		session.api.mockResolvedValue({ id: 'student', username: 'student', host: null, publicReactions: true });
		const view = render(UserProfile, {
			props: { acct: 'student' },
			global: { components: { PageWithHeader: { props: ['tabs'], template: '<div><button v-for="tab in tabs" :data-tab="tab.key">{{ tab.title }}</button><slot/></div>' } } },
		});
		await waitFor(() => expect(view.queryByText('Profile')).not.toBeNull());
		for (const tab of ['pages', 'flashs', 'gallery']) expect(view.container.querySelector(`[data-tab="${tab}"]`)).toBeNull();
		for (const tab of ['home', 'notes', 'files', 'activity', 'achievements', 'reactions', 'clips', 'lists']) expect(view.container.querySelector(`[data-tab="${tab}"]`)).not.toBeNull();
		expect(session.api).toHaveBeenCalledExactlyOnceWith('users/show', { username: 'student', host: null });
	});

	test.each(roles)('%s: generated settings search omits secondary resources and descendants', role => {
		setRole(role);
		const index = filterMvpSearchIndex(genSearchIndexes(searchIndexes));
		for (const keyword of ['antennas', 'deck', 'rss', 'statusbar']) {
			expect(index.filter(item => item.keywords.includes(keyword) || item.id === `mvp-secondary-${keyword}`), keyword).toEqual([]);
		}
		for (const path of ['/settings/security', '/settings/theme', '/settings/account-data']) expect(index.some(item => item.path === path)).toBe(true);
	});

	test.each(roles)('%s: restored statusbars never mount or execute and keep saved values', role => {
		setRole(role);
		const saved = [{ id: 'rss', type: 'rss', props: { url: 'https://example.test/feed' } }, { id: 'list', type: 'userList', props: { userListId: 'saved' } }];
		preferReactive.statusbars = ref(structuredClone(saved));
		const view = render(Statusbars);
		expect(view.container.textContent).toBe('');
		expect(session.execute).not.toHaveBeenCalled();
		expect(preferReactive.statusbars.value).toEqual(saved);
	});

	test('old, restored and synchronized Deck choices remain stored while the effective UI stays standard', () => {
		const backup = { ui: 'deck', 'deck.profiles': { saved: { columns: [{ type: 'antenna', antennaId: 'existing' }] } } };
		const restored = structuredClone(backup);
		localStorage.setItem('ui', restored.ui);
		for (const choice of [localStorage.getItem('ui'), 'deck', 'zen', 'visitor', null]) {
			expect(getMvpUi(choice, true)).toBe('default');
			expect(getMvpUi(choice, false)).toBe('visitor');
		}
		expect(localStorage.getItem('ui')).toBe('deck');
		expect(restored).toEqual(backup);
	});
});
