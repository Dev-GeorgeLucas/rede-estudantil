/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/vue';
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

const actions = vi.hoisted(() => ({ popupMenu: vi.fn(), post: vi.fn(), select: vi.fn(), success: vi.fn(), commit: vi.fn() }));
vi.mock('@/i.js', async () => {
	const { reactive } = await import('vue');
	return { $i: reactive({ isAdmin: false, isModerator: false, unreadNotificationsCount: 0, policies: { chatAvailability: 'available', canManageCustomEmojis: false, canManageAvatarDecorations: false } }), iAmModerator: false };
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
const savedMenu = ['notifications', 'chat', 'channels', 'drive', 'tools'];
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('MVP shared navigation', () => {
	test('navbar editing and reset keep hidden saved items, and the selector cannot add technical tools', async () => {
		$i!.isAdmin = false;
		$i!.isModerator = false;
		preferState.menu = [...savedMenu];
		Object.assign(prefer, { model: () => ref(false), commit: actions.commit });
		actions.select.mockResolvedValue({ canceled: true });
		const view = render(NavbarSettings, { global });
		expect(view.queryByText(i18n.ts.tools)).toBeNull();
		await fireEvent.click(view.getByText('Reorder'));
		await fireEvent.click(view.getByText(i18n.ts.save));
		expect(actions.commit).toHaveBeenLastCalledWith('menu', ['drive', 'channels', 'chat', 'notifications', 'tools']);
		await fireEvent.click(view.getByText(i18n.ts.default));
		await fireEvent.click(view.getByText(i18n.ts.save));
		expect(actions.commit).toHaveBeenLastCalledWith('menu', savedMenu);
		await fireEvent.click(view.getByText(i18n.ts.addItem));
		expect(actions.select.mock.calls[0][0].items).not.toEqual(expect.arrayContaining([expect.objectContaining({ value: 'tools' })]));
	});

	test.each(['user', 'moderator', 'admin'])('%s: desktop, mobile drawer, Deck and More keep core features', async role => {
		$i!.isAdmin = role === 'admin';
		$i!.isModerator = role === 'moderator';
		for (const [component, width, props] of [[Navbar, 1440, {}], [Navbar, 390, { asDrawer: true }], [DeckNavbar, 1440, {}]] as const) {
			window.innerWidth = width;
			preferState.menu = [...savedMenu];
			preferReactive.menu = ref([...savedMenu]);
			preferReactive.showNavbarSubButtons = ref(false);
			const view = render(component, { props, global });
			for (const path of ['/chat', '/channels', '/my/notifications', '/my/drive']) {
				expect(view.container.querySelector(`a[href="${path}"]`), path).not.toBeNull();
			}
			expect(!!view.container.querySelector('.ti-tool')).toBe(role === 'admin');
			expect(!!view.container.querySelector('a[href="/admin"]')).toBe(role !== 'user');
			const post = view.container.querySelector('[data-testid="open-post-form"]') ?? view.container.querySelector('.ti-pencil')!;
			await fireEvent.click(post);
			expect(actions.post).toHaveBeenCalled();
			expect(preferState.menu).toEqual(savedMenu);
			view.unmount();
		}
		preferState.menu = [];
		const more = render(LaunchPad, { global });
		for (const path of ['/chat', '/channels', '/my/notifications', '/my/drive']) expect(more.container.querySelector(`a[href="${path}"]`)).not.toBeNull();
		expect(!!more.queryByText(i18n.ts.tools)).toBe(role === 'admin');
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
