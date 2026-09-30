/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/vue';
import MkWidgets from '@/components/MkWidgets.vue';

const session = vi.hoisted(() => ({ user: null as null | { isAdmin: boolean; isModerator: boolean; policies: { chatAvailability: string } } }));
vi.mock('@/i.js', () => ({
	get $i() { return session.user; },
	get iAmModerator() { return !!(session.user?.isAdmin || session.user?.isModerator); },
}));
vi.mock('@/instance.js', () => ({ instance: { federation: 'all' } }));
vi.mock('@/os.js', () => ({ contextMenu: vi.fn() }));
vi.mock('@/composables/use-mkselect.js', async () => {
	const { ref } = await import('vue');
	return { useMkSelect: () => ({ model: ref(null), def: [] }) };
});
vi.mock('@/components/MkSelect.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkButton.vue', () => ({ default: { template: '<button><slot/></button>' } }));
vi.mock('@/components/MkDraggable.vue', () => ({ default: {
	props: ['modelValue'],
	emits: ['update:modelValue'],
	template: '<div><button @click="$emit(\'update:modelValue\', [...modelValue].reverse())">Reorder</button><slot v-for="item in modelValue" :item="item"/></div>',
} }));
vi.mock('@/pages/timeline.vue', () => ({ __esModule: true, default: { name: 'Following' } }));
vi.mock('@/pages/_loading_.vue', () => ({ default: {} }));
vi.mock('@/pages/_error_.vue', () => ({ default: {} }));
vi.mock('@/pages/not-found.vue', () => ({ __esModule: true, default: { name: 'NotFound' } }));
vi.mock('@/pages/instance-info.vue', () => ({ __esModule: true, default: { name: 'InstanceInfo' } }));
vi.mock('@/pages/explore.vue', () => ({ __esModule: true, default: { name: 'Explore' } }));
vi.mock('@/pages/admin/federation.vue', () => ({ __esModule: true, default: { name: 'AdminFederation' } }));
vi.mock('@/pages/admin/federation-job-queue.vue', () => ({ __esModule: true, default: { name: 'AdminFederationQueue' } }));

afterEach(cleanup);

async function loadComponent(component: unknown): Promise<{ name: string }> {
	return (component as { __asyncLoader: () => Promise<{ name: string }> }).__asyncLoader();
}

const widgets = [
	{ id: 'timeline', name: 'timeline', data: {} },
	{ id: 'federation', name: 'federation', data: { showHeader: false } },
	{ id: 'cloud', name: 'instanceCloud', data: {} },
];
const roles = ['visitor', 'user', 'moderator', 'admin'] as const;

function setRole(role: typeof roles[number]) {
	session.user = role === 'visitor' ? null : { isAdmin: role === 'admin', isModerator: role === 'moderator', policies: { chatAvailability: 'available' } };
}

function renderWidgets(edit: boolean) {
	return render(MkWidgets, {
		props: { widgets, edit },
		global: { components: {
			WidgetTimeline: { template: '<div>Following widget</div>' },
			WidgetFederation: { template: '<div>Federation widget</div>' },
			WidgetInstanceCloud: { template: '<div>Server cloud</div>' },
		} },
	});
}

describe('MVP federation surfaces', () => {
	test.each(roles)('%s: existing widgets respect visibility in view and edit modes', (role) => {
		setRole(role);
		for (const edit of [false, true]) {
			const view = renderWidgets(edit);
			expect(view.queryByText('Following widget')).not.toBeNull();
			const isStaff = role === 'admin' || role === 'moderator';
			expect(view.queryByText('Federation widget') !== null).toBe(isStaff);
			expect(view.queryByText('Server cloud') !== null).toBe(isStaff);
			view.unmount();
		}
	});

	test('reordering visible widgets retains hidden federation configuration', async () => {
		setRole('user');
		const view = renderWidgets(true);
		await fireEvent.click(view.getByText('Reorder'));
		expect(view.emitted().updateWidgets).toEqual([[widgets]]);
	});

	test.each(roles)('%s: direct instance-info URL is guarded without disabling admin routes', async (role) => {
		setRole(role);
		vi.resetModules();
		const { ROUTE_DEF } = await import('@/router.definition.js');
		const instanceRoute = ROUTE_DEF.find(route => route.path === '/instance-info/:host')!;
		const isStaff = role === 'admin' || role === 'moderator';
		expect((await loadComponent(instanceRoute.component)).name).toBe(isStaff ? 'InstanceInfo' : 'NotFound');

		const admin = ROUTE_DEF.find(route => route.path === '/admin')!;
		for (const [path, name] of [['/federation', 'AdminFederation'], ['/federation-job-queue', 'AdminFederationQueue']]) {
			const route = admin.children.find(child => child.path === path)!;
			expect((await loadComponent(route.component)).name).toBe(name);
		}
		if (role === 'visitor') {
			const timeline = ROUTE_DEF.find(route => route.path === '/timeline')!;
			expect((await loadComponent(timeline.component)).name).toBe('Explore');
		}
	});
});
