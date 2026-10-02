/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/vue';
import { preferState, preferReactive } from '../setup.unit.js';
import { ref } from 'vue';
import Navbar from '@/ui/_common_/navbar.vue';
import DeckNavbar from '@/ui/_common_/navbar-h.vue';
import LaunchPad from '@/components/MkLaunchPad.vue';
import NavbarSettings from '@/pages/settings/navbar.vue';
import { prefer } from '@/preferences.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { openInstanceMenu, toolsMenuItems } from '@/ui/_common_/common.js';
import { getVisibleNavbarItems } from '@/navbar.js';

const visitor = vi.hoisted(() => ({ active: false }));
const actions = vi.hoisted(() => ({ popupMenu: vi.fn(), post: vi.fn(), select: vi.fn(), success: vi.fn(), commit: vi.fn() }));
vi.mock('@/i.js', async () => {
	const { reactive } = await import('vue');
	const user = reactive({ isAdmin: false, isModerator: false, unreadNotificationsCount: 0, policies: { chatAvailability: 'available', canManageCustomEmojis: false, canManageAvatarDecorations: false } });
	return { get $i() { return visitor.active ? null : user; }, iAmModerator: false };
});
vi.mock('@/os.js', () => ({ ...actions, __v_isRef: false }));
vi.mock('@/instance.js', () => ({ instance: { name: 'School', federation: 'all' } }));
vi.mock('@/router.js', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/accounts.js', () => ({ getAccountMenu: vi.fn() }));
vi.mock('@/utility/clear-cache.js', () => ({ clearCache: vi.fn() }));
vi.mock('@/utility/lookup.js', () => ({ lookup: vi.fn() }));
vi.mock('@/utility/unison-reload.js', () => ({ unisonReload: vi.fn() }));
vi.mock('@/store.js', async () => {
	const { ref } = await import('vue');
	return { store: { s: {}, r: { menuDisplay: ref('sideFull'), realtimeMode: ref(false) }, model: () => ref('sideFull') } };
});
vi.mock('@/components/MkButton.vue', () => ({ default: { template: '<button><slot/></button>' } }));
vi.mock('@/components/MkModal.vue', () => ({ default: { template: '<div><slot type="drawer"/></div>' } }));

vi.mock('@/page.js', () => ({ definePage: vi.fn() }));
vi.mock('@/preferences/manager.js', () => ({ getInitialPrefValue: () => ['notifications', 'chat', 'channels', 'drive'] }));
vi.mock('@/components/MkRadios.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkSwitch.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkContainer.vue', () => ({ default: { template: '<div><slot/></div>' } }));
vi.mock('@/components/MkPreferenceContainer.vue', () => ({ default: { template: '<div><slot/></div>' } }));
vi.mock('@/components/form/slot.vue', () => ({ default: { template: '<div><slot/></div>' } }));
vi.mock('@/components/MkDraggable.vue', () => ({ default: {
	props: ['modelValue'], emits: ['update:modelValue'],
	template: '<div><button @click="$emit(\'update:modelValue\', [...modelValue].reverse())">Reorder</button><slot v-for="item in modelValue" :item="item"/></div>',
} }));

const global = {
	components: { SearchMarker: { template: '<div><slot/></div>' }, MkA: { props: ['to'], template: '<a :href="to"><slot/></a>' }, MkAvatar: { render: () => null }, MkAcct: { render: () => null } },
	directives: { tooltip: {}, 'click-anime': {} },
};
const hiddenMenu = ['antennas', 'pages', 'play', 'gallery', 'ui'];
const savedMenu = ['notifications', 'chat', 'channels', 'drive', 'tools'];
afterEach(() => { cleanup(); vi.clearAllMocks(); visitor.active = false; });

describe('MVP shared navigation', () => {
	test.each([
		{ stored: [], expected: [] },
		{ stored: ['-', '-'], expected: [] },
		{ stored: ['-', 'ui', '-', 'antennas', '-'], expected: [] },
		{ stored: ['-', 'notifications', '-', '-'], expected: ['notifications'] },
		{ stored: ['notifications', '-', 'ui', '-', '-', 'chat'], expected: ['notifications', '-', 'chat'] },
		{ stored: ['notifications', 'chat', '-', 'drive'], expected: ['notifications', 'chat', '-', 'drive'] },
	])('normalizes visible groups without modifying saved items: $stored', ({ stored, expected }) => {
		const original = [...stored];
		expect(getVisibleNavbarItems(stored, item => item)).toEqual(expected);
		expect(stored).toEqual(original);
		const editorItems = stored.map((type, id) => ({ type, id }));
		const visible = getVisibleNavbarItems(editorItems, item => item.type);
		expect(visible.map(item => item.type)).toEqual(expected);
		for (const item of visible) expect(item).toBe(editorItems[item.id]);
	});

	test.each([
		{ name: 'desktop', component: Navbar, width: 1440, props: {} },
		{ name: 'mobile drawer', component: Navbar, width: 390, props: { asDrawer: true } },
		{ name: 'horizontal', component: DeckNavbar, width: 1440, props: {} },
	])('$name renders one divider between remaining groups, including the fixed footer group', async ({ component, width, props }) => {
		$i!.isAdmin = false;
		$i!.isModerator = false;
		window.innerWidth = width;
		const layout = ['-', 'notifications', '-', 'ui', '-', '-', 'chat', '-', '-'];
		preferState.menu = [...layout];
		preferReactive.menu = ref([...layout]);
		preferReactive.showNavbarSubButtons = ref(false);
		const view = render(component, { props, global });
		function menuBetweenFollowingAndMore() {
			const following = view.container.querySelector('a[href="/"]')!;
			const more = view.container.querySelector('.ti-grid-dots, .ti-dots')!.closest('button')!;
			const siblings = Array.from(following.parentElement!.children);
			return siblings.slice(siblings.indexOf(following) + 1, siblings.indexOf(more)).map(el => el.getAttribute('href') ?? '-');
		}
		expect(menuBetweenFollowingAndMore()).toEqual(['/my/notifications', '-', '/chat', '-']);
		expect(preferState.menu).toEqual(layout);
		// Live updates/restored layouts must use the same projection in every variant.
		preferReactive.menu.value = ['-', 'ui', '-', 'antennas', '-'];
		await waitFor(() => expect(menuBetweenFollowingAndMore()).toEqual(['-']));
		view.unmount();
	});

	test('navbar editor normalizes empty groups while reordering, removing and saving preserves hidden items', async () => {
		$i!.isAdmin = false;
		const layout = ['-', 'notifications', '-', 'ui', '-', '-', 'chat', '-', 'antennas', '-'];
		preferState.menu = [...layout];
		Object.assign(prefer, { model: () => ref(false), commit: actions.commit });
		const view = render(NavbarSettings, { global });
		expect(view.getAllByText(i18n.ts.divider)).toHaveLength(1);
		expect(preferState.menu).toEqual(layout);
		await fireEvent.click(view.getByText('Reorder'));
		expect(view.getAllByText(i18n.ts.divider)).toHaveLength(1);
		await fireEvent.click(view.getByText(i18n.ts.save));
		const saved = actions.commit.mock.lastCall![1] as string[];
		expect(saved.filter(item => item !== '-').sort()).toEqual(layout.filter(item => item !== '-').sort());
		expect(getVisibleNavbarItems(saved, item => item)).toEqual(['chat', '-', 'notifications']);
		const removeChat = view.getByText(i18n.ts.directMessage_short).parentElement!.querySelectorAll('button')[1];
		await fireEvent.click(removeChat);
		expect(view.queryByText(i18n.ts.divider)).toBeNull();
	});

	test('new dividers appear between editable items and remain editable after reordering', async () => {
		preferState.menu = ['notifications', 'ui', 'chat'];
		Object.assign(prefer, { model: () => ref(false), commit: actions.commit });
		actions.select.mockResolvedValueOnce({ result: '-', canceled: false }).mockResolvedValueOnce({ canceled: true });
		const view = render(NavbarSettings, { global });
		await fireEvent.click(view.getByText(i18n.ts.addItem));
		expect(view.getAllByText(i18n.ts.divider)).toHaveLength(1);
		await fireEvent.click(view.getByText('Reorder'));
		expect(view.getAllByText(i18n.ts.divider)).toHaveLength(1);
		await fireEvent.click(view.getByText(i18n.ts.save));
		expect(getVisibleNavbarItems(actions.commit.mock.lastCall![1] as string[], item => item)).toEqual(['chat', '-', 'notifications']);
		await fireEvent.click(view.getByText(i18n.ts.addItem));
		expect(actions.select.mock.lastCall![0].items).not.toContainEqual({ value: '-', label: i18n.ts.divider });
		const removeDivider = view.getByText(i18n.ts.divider).parentElement!.querySelectorAll('button')[1];
		await fireEvent.click(removeDivider);
		expect(view.queryByText(i18n.ts.divider)).toBeNull();
		await fireEvent.click(view.getByText(i18n.ts.save));
		expect((actions.commit.mock.lastCall![1] as string[]).sort()).toEqual(['chat', 'notifications', 'ui']);
	});

	test('navbar editing and reset keep hidden saved items, and the selector cannot add technical tools', async () => {
		$i!.isAdmin = false;
		$i!.isModerator = false;
		preferState.menu = [...savedMenu, ...hiddenMenu];
		Object.assign(prefer, { model: () => ref(false), commit: actions.commit });
		actions.select.mockResolvedValue({ canceled: true });
		const view = render(NavbarSettings, { global });
		expect(view.queryByText(i18n.ts.tools)).toBeNull();
		await fireEvent.click(view.getByText('Reorder'));
		await fireEvent.click(view.getByText(i18n.ts.save));
		expect(actions.commit).toHaveBeenLastCalledWith('menu', ['drive', 'channels', 'chat', 'notifications', 'tools', ...hiddenMenu]);
		await fireEvent.click(view.getByText(i18n.ts.default));
		await fireEvent.click(view.getByText(i18n.ts.save));
		expect(actions.commit).toHaveBeenLastCalledWith('menu', [...savedMenu, ...hiddenMenu]);
		await fireEvent.click(view.getByText(i18n.ts.addItem));
		for (const value of hiddenMenu) expect(actions.select.mock.calls[0][0].items).not.toEqual(expect.arrayContaining([expect.objectContaining({ value })]));
		expect(actions.select.mock.calls[0][0].items).not.toEqual(expect.arrayContaining([expect.objectContaining({ value: 'tools' })]));
	});

	test.each(['user', 'moderator', 'admin'])('%s: desktop, mobile drawer, Deck and More keep core features', async role => {
		$i!.isAdmin = role === 'admin';
		$i!.isModerator = role === 'moderator';
		for (const [component, width, props] of [[Navbar, 1440, {}], [Navbar, 390, { asDrawer: true }], [DeckNavbar, 1440, {}]] as const) {
			window.innerWidth = width;
			const layout = [...savedMenu, ...hiddenMenu, 'explore', 'announcements', 'lists', 'favorites', 'clips'];
			preferState.menu = layout;
			preferReactive.menu = ref(layout);
			preferReactive.showNavbarSubButtons = ref(false);
			const view = render(component, { props, global });
			for (const path of ['/chat', '/channels', '/my/notifications', '/my/drive', '/explore', '/announcements', '/my/lists', '/my/favorites', '/my/clips']) {
				expect(view.container.querySelector(`a[href="${path}"]`), path).not.toBeNull();
			}
			for (const path of ['/my/antennas', '/pages', '/play', '/gallery']) expect(view.container.querySelector(`a[href="${path}"]`)).toBeNull();
			expect(view.queryByText(i18n.ts.switchUi)).toBeNull();
			expect(!!view.container.querySelector('.ti-tool')).toBe(role === 'admin');
			expect(!!view.container.querySelector('a[href="/admin"]')).toBe(role !== 'user');
			const post = view.container.querySelector('[data-testid="open-post-form"]') ?? view.container.querySelector('.ti-pencil')!;
			await fireEvent.click(post);
			expect(actions.post).toHaveBeenCalled();
			expect(preferState.menu).toEqual(layout);
			view.unmount();
		}
		preferState.menu = [];
		const more = render(LaunchPad, { global });
		for (const path of ['/chat', '/channels', '/my/notifications', '/my/drive', '/explore', '/announcements', '/my/lists', '/my/favorites', '/my/clips']) expect(more.container.querySelector(`a[href="${path}"]`)).not.toBeNull();
		for (const path of ['/my/antennas', '/pages', '/play', '/gallery']) expect(more.container.querySelector(`a[href="${path}"]`)).toBeNull();
		expect(more.queryByText(i18n.ts.switchUi)).toBeNull();
		expect(!!more.queryByText(i18n.ts.tools)).toBe(role === 'admin');
	});

	test('visitors see no secondary feature in desktop, mobile or More menus', () => {
		visitor.active = true;
		preferState.menu = [];
		preferReactive.menu = ref([...hiddenMenu, 'explore', 'announcements']);
		for (const component of [Navbar, DeckNavbar, LaunchPad]) {
			preferState.menu = component === LaunchPad ? [] : [...hiddenMenu, 'explore', 'announcements'];
			for (const width of [390, 1440]) {
				window.innerWidth = width;
				const view = render(component, { global });
				for (const path of ['/my/antennas', '/pages', '/play', '/gallery']) expect(view.container.querySelector(`a[href="${path}"]`)).toBeNull();
				expect(view.queryByText(i18n.ts.switchUi)).toBeNull();
				expect(view.container.querySelector('a[href="/explore"]')).not.toBeNull();
				view.unmount();
			}
		}
	});

	test('visual management permissions retain their tools without exposing technical links', () => {
		$i!.isAdmin = false;
		$i!.policies.canManageCustomEmojis = true;
		const items = toolsMenuItems();
		expect(items).toEqual([expect.objectContaining({ to: '/custom-emojis-manager' })]);
		$i!.policies.canManageCustomEmojis = false;
	});

	test('public instance menu contains neither technical links nor an empty Tools menu', () => {
		$i!.isAdmin = false;
		openInstanceMenu({ target: document.body } as unknown as PointerEvent);
		const items = actions.popupMenu.mock.calls[0][0];
		expect(items).not.toEqual(expect.arrayContaining([expect.objectContaining({ to: '/about#charts' })]));
		expect(items).not.toEqual(expect.arrayContaining([expect.objectContaining({ text: i18n.ts.tools })]));
	});
});
