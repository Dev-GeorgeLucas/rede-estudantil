/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/vue';
import MkWidgets from '@/components/MkWidgets.vue';
import { canUseAdvancedFeatures, filterMvpSearchIndex, isMvpPathVisible } from '@/mvp-visibility.js';
import { searchIndexes } from 'search-index:settings';
import { genSearchIndexes } from '@/utility/inapp-search.js';
import { widgets as widgetDefs } from '@/widgets/index.js';

const session = vi.hoisted(() => ({ user: null as null | { isAdmin: boolean; isModerator: boolean; policies: { chatAvailability: string } } }));
vi.mock('@/i.js', () => ({
	get $i() { return session.user; },
	get iAmModerator() { return !!(session.user?.isAdmin || session.user?.isModerator); },
}));
vi.mock('@/instance.js', () => ({ instance: { federation: 'all' } }));
vi.mock('@/os.js', () => ({ contextMenu: vi.fn() }));
vi.mock('@/composables/use-mkselect.js', async () => {
	const { ref } = await import('vue');
	return { useMkSelect: (options: { items: unknown }) => ({ model: ref(null), def: options.items }) };
});
vi.mock('@/components/MkSelect.vue', () => ({ default: { props: ['items'], template: '<select><option v-for="item in items" :value="item.value">{{ item.label }}</option></select>' } }));
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

vi.mock('@/pages/api-console.vue', () => ({ __esModule: true, default: { name: 'api-console' } }));
vi.mock('@/pages/scratchpad.vue', () => ({ __esModule: true, default: { name: 'scratchpad' } }));
vi.mock('@/pages/registry.vue', () => ({ __esModule: true, default: { name: 'registry' } }));
vi.mock('@/pages/registry.keys.vue', () => ({ __esModule: true, default: { name: 'registry.keys' } }));
vi.mock('@/pages/registry.value.vue', () => ({ __esModule: true, default: { name: 'registry.value' } }));
vi.mock('@/pages/debug.vue', () => ({ __esModule: true, default: { name: 'debug' } }));
vi.mock('@/pages/preview.vue', () => ({ __esModule: true, default: { name: 'preview' } }));
vi.mock('@/pages/clicker.vue', () => ({ __esModule: true, default: { name: 'clicker' } }));
vi.mock('@/pages/settings/plugin.vue', () => ({ __esModule: true, default: { name: 'settings/plugin' } }));
vi.mock('@/pages/settings/plugin.install.vue', () => ({ __esModule: true, default: { name: 'settings/plugin.install' } }));
vi.mock('@/pages/settings/custom-css.vue', () => ({ __esModule: true, default: { name: 'settings/custom-css' } }));
vi.mock('@/pages/settings/webhook.new.vue', () => ({ __esModule: true, default: { name: 'settings/webhook.new' } }));
vi.mock('@/pages/settings/apps.vue', () => ({ __esModule: true, default: { name: 'settings/apps' } }));
vi.mock('@/pages/settings/webhook.edit.vue', () => ({ __esModule: true, default: { name: 'settings/webhook.edit' } }));
vi.mock('@/pages/settings/theme.vue', () => ({ __esModule: true, default: { name: 'settings/theme' } }));
vi.mock('@/pages/settings/theme.install.vue', () => ({ __esModule: true, default: { name: 'settings/theme.install' } }));
vi.mock('@/pages/settings/theme.manage.vue', () => ({ __esModule: true, default: { name: 'settings/theme.manage' } }));
vi.mock('@/pages/theme-editor.vue', () => ({ __esModule: true, default: { name: 'theme-editor' } }));
vi.mock('@/pages/install-extensions.vue', () => ({ __esModule: true, default: { name: 'install-extensions' } }));
vi.mock('@/pages/chat/home.vue', () => ({ __esModule: true, default: { name: 'chat/home' } }));
vi.mock('@/pages/channels.vue', () => ({ __esModule: true, default: { name: 'channels' } }));
vi.mock('@/pages/notifications.vue', () => ({ __esModule: true, default: { name: 'notifications' } }));
vi.mock('@/pages/drive.vue', () => ({ __esModule: true, default: { name: 'drive' } }));
vi.mock('@/pages/share.vue', () => ({ __esModule: true, default: { name: 'share' } }));
vi.mock('@/pages/auth.vue', () => ({ __esModule: true, default: { name: 'auth' } }));
vi.mock('@/pages/miauth.vue', () => ({ __esModule: true, default: { name: 'miauth' } }));
vi.mock('@/pages/oauth.vue', () => ({ __esModule: true, default: { name: 'oauth' } }));
vi.mock('@/pages/settings/security.vue', () => ({ __esModule: true, default: { name: 'settings/security' } }));
vi.mock('@/pages/pages.vue', () => ({ __esModule: true, default: { name: 'pages' } }));
vi.mock('@/pages/gallery/index.vue', () => ({ __esModule: true, default: { name: 'gallery/index' } }));
vi.mock('@/pages/flash/flash-index.vue', () => ({ __esModule: true, default: { name: 'flash/flash-index' } }));
vi.mock('@/pages/my-antennas/index.vue', () => ({ __esModule: true, default: { name: 'my-antennas/index' } }));
vi.mock('@/pages/settings/connect.vue', () => ({ __esModule: true, default: { name: 'settings/connect' } }));

const roles = ['visitor', 'user', 'moderator', 'admin'] as const;

function setRole(role: typeof roles[number]) {
	session.user = role === 'visitor' ? null : { isAdmin: role === 'admin', isModerator: role === 'moderator', policies: { chatAvailability: 'available' } };
}

const secondaryNames = ['rss', 'rssTicker'];
const hiddenNames = ['aiscript', 'aiscriptApp', 'button', 'serverMetric', 'jobQueue', 'unixClock', 'clicker'];
const storedWidgets = [
	{ id: 'memo', name: 'memo', data: { text: 'Homework' } },
	...[...hiddenNames, ...secondaryNames].map(name => ({ id: name, name, data: { script: 'saved script', count: 42 } })),
	{ id: 'antenna', name: 'timeline', data: { src: 'antenna', antenna: { id: 'saved', name: 'Saved antenna' } } },
	{ id: 'clock', name: 'clock', data: {} },
];

function renderWidgets(edit: boolean) {
	return render(MkWidgets, {
		props: { widgets: structuredClone(storedWidgets), edit },
		global: { components: Object.fromEntries(widgetDefs.map(name => [
			`Widget${name[0].toUpperCase()}${name.slice(1)}`,
			{ template: `<div data-widget="${name}">${name}</div>` },
		])) },
	});
}

describe('MVP advanced visibility', () => {
	test('the generated settings index hides plugins and developer controls but includes token revocation', () => {
		setRole('user');
		const index = filterMvpSearchIndex(genSearchIndexes(searchIndexes));
		expect(index.some(item => item.path?.startsWith('/settings/plugin'))).toBe(false);
		expect(index.some(item => item.id.startsWith('mvp-advanced-'))).toBe(false);
		expect(index.some(item => item.label === 'Manage access tokens')).toBe(true);
		expect(index.some(item => item.path === '/settings/theme')).toBe(true);
	});

	test.each(roles)('%s: selector and mounting respect the policy, including restored layouts', async role => {
		setRole(role);
		for (const width of [390, 1440]) {
			window.innerWidth = width;
			for (const edit of [false, true]) {
				const view = renderWidgets(edit);
				expect(view.container.querySelector('[data-widget="memo"]')).not.toBeNull();
				for (const name of hiddenNames) {
					expect(!!view.container.querySelector(`[data-widget="${name}"]`)).toBe(role === 'admin');
					if (edit) expect(!!view.container.querySelector(`option[value="${name}"]`)).toBe(role === 'admin');
				}
				expect(view.container.querySelector('[data-widget="timeline"]')).toBeNull();
				for (const name of secondaryNames) {
					expect(view.container.querySelector(`[data-widget="${name}"]`)).toBeNull();
					if (edit) expect(view.container.querySelector(`option[value="${name}"]`)).toBeNull();
				}
				if (edit) {
					await fireEvent.click(view.getByText('Reorder'));
					const updated = (view.emitted().updateWidgets as [typeof storedWidgets][])[0][0];
					expect(updated.map(w => w.id).sort()).toEqual(storedWidgets.map(w => w.id).sort());
					for (const widget of storedWidgets) expect(updated.find(w => w.id === widget.id)).toEqual(widget);
					if (role !== 'admin') expect(updated.slice(1, -1)).toEqual(storedWidgets.slice(1, -1));
				}
				view.unmount();
			}
		}
	});

	test.each(roles)('%s: blocked routes use the standard not-found component; admins retain direct support access', async role => {
		setRole(role);
		vi.resetModules();
		const { ROUTE_DEF } = await import('@/router.definition.js');
		const settings = ROUTE_DEF.find(r => r.path === '/settings')!;
		const routes = [
			...ROUTE_DEF.map(r => ({ ...r, fullPath: r.path })),
			...settings.children.map(r => ({ ...r, fullPath: `/settings${r.path}` })),
		];
		const blocked = ['/api-console', '/scratchpad', '/registry', '/registry/keys/:domain/:path(*)?', '/registry/value/:domain/:path(*)?', '/debug', '/preview', '/clicker', '/settings/plugin', '/settings/plugin/install', '/settings/custom-css', '/settings/webhook/new'];
		for (const path of blocked) {
			const route = routes.find(r => r.fullPath === path)!;
			expect('component' in route).toBe(true);
			if ('component' in route) expect((await loadComponent(route.component)).name === 'NotFound').toBe(role !== 'admin');
		}
		const kept = ['/settings/apps', '/settings/connect', '/settings/webhook/edit/:webhookId', '/settings/security', '/settings/theme', '/settings/theme/install', '/settings/theme/manage', '/theme-editor', '/install-extensions', '/chat', '/channels', '/my/notifications', '/my/drive', '/share', '/auth/:token', '/miauth/:session', '/oauth/authorize'];
		for (const path of kept) {
			const route = routes.find(r => r.fullPath === path)!;
			if ('component' in route) expect((await loadComponent(route.component)).name, path).not.toBe('NotFound');
			else throw new Error(`Missing component: ${path}`);
		}
		expect(ROUTE_DEF.find(r => r.path === '/install-extentions')!.redirect).toBe('/install-extensions');
	});

	test.each(roles)('%s: settings search filters hidden descendants and hashes but retains revocation and themes', role => {
		setRole(role);
		const items = [
			{ id: 'plugins', path: '/settings/plugin' },
			{ id: 'plugin-child', parentId: 'plugins' },
			{ id: 'css', path: '/settings/custom-css#editor' },
			{ id: 'mvp-advanced-developer', path: '/settings/other' },
			{ id: 'dev-child', parentId: 'mvp-advanced-developer' },
			{ id: 'apps', path: '/settings/apps' },
			{ id: 'themes', path: '/settings/theme' },
		].map(item => ({ ...item, label: item.id, keywords: [], texts: [] }));
		expect(filterMvpSearchIndex(items).map(i => i.id)).toEqual(role === 'admin' ? items.map(i => i.id) : ['apps', 'themes']);
		expect(isMvpPathVisible('/about#charts')).toBe(role === 'admin');
		expect(canUseAdvancedFeatures()).toBe(role === 'admin');
	});
});
