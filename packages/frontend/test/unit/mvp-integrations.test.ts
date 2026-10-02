/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/vue';
import { defineComponent, h, Suspense } from 'vue';
import type { Component } from 'vue';
import Connect from '@/pages/settings/connect.vue';
import Apps from '@/pages/settings/apps.vue';
import Webhook from '@/pages/settings/webhook.edit.vue';
import Installer from '@/pages/install-extensions.vue';
import { i18n } from '@/i18n.js';

const state = vi.hoisted(() => ({
	user: { isAdmin: false, isModerator: false },
	api: vi.fn(), dialogApi: vi.fn(), installTheme: vi.fn(), installPlugin: vi.fn(), parsePlugin: vi.fn(), reload: vi.fn(),
}));
const stubs = vi.hoisted(() => ({
	box: { template: '<div><slot name="label"/><slot/><slot name="footer"/></div>' },
	button: { template: '<button><slot/></button>' },
	link: { props: ['to'], template: '<a :href="to"><slot/></a>' },
}));
vi.mock('@/i.js', () => ({ get $i() { return state.user; } }));
vi.mock('@/page.js', () => ({ definePage: vi.fn() }));
vi.mock('@/router.js', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: state.api }));
vi.mock('@/os.js', () => ({ apiWithDialog: state.dialogApi, confirm: async () => ({ canceled: false }), success: vi.fn(), popupAsyncWithDialog: vi.fn() }));
vi.mock('@/theme.js', () => ({ installTheme: state.installTheme }));
vi.mock('@/plugin.js', () => ({ parsePluginMeta: state.parsePlugin, installPlugin: state.installPlugin }));
vi.mock('@/utility/unison-reload.js', () => ({ unisonReload: vi.fn() }));
vi.mock('@/utility/paginator.js', () => ({ Paginator: class {
	constructor(public endpoint: string) {}
	reload = state.reload;
} }));
vi.mock('@/components/MkPagination.vue', () => ({ default: {
	props: ['paginator'],
	data: () => ({ items: [{ id: 'existing', name: 'Existing integration', url: 'https://example.test/hook', permission: [] }] }),
	template: '<div><slot :items="items"/></div>',
} }));
vi.mock('@/components/MkButton.vue', () => ({ default: stubs.button }));
vi.mock('@/components/form/link.vue', () => ({ default: stubs.link }));
vi.mock('@/components/form/section.vue', () => ({ default: stubs.box }));
vi.mock('@/components/MkFolder.vue', () => ({ default: stubs.box }));
vi.mock('@/components/MkFeatureBanner.vue', () => ({ default: stubs.box }));
vi.mock('@/components/MkKeyValue.vue', () => ({ default: stubs.box }));
vi.mock('@/components/global/MkUrl.vue', () => ({ default: stubs.box }));
vi.mock('@/components/global/MkLoading.vue', () => ({ default: stubs.box }));
vi.mock('@/components/MkInput.vue', () => ({ default: {
	props: ['modelValue'], emits: ['update:modelValue'],
	template: '<label><slot name="label"/><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)"/></label>',
} }));
vi.mock('@/components/MkSwitch.vue', () => ({ default: {
	props: ['modelValue'], emits: ['update:modelValue'],
	template: '<label><slot/><input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)"/></label>',
} }));
vi.mock('@/components/MkExtensionInstaller.vue', () => ({ default: {
	props: ['extension'], emits: ['confirm'],
	template: '<button @click="$emit(\'confirm\')">Install {{ extension.type }}</button>',
} }));

function mount(component: Component, props = {}) {
	return render(defineComponent({ render: () => h('div', [h(Suspense, null, { default: () => h(component, props) })]) }), {
		global: { components: { SearchMarker: stubs.box, SearchText: stubs.box, SearchLabel: stubs.box, PageWithAnimBg: stubs.box } },
	});
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('MVP integration recovery', () => {
	for (const width of [390, 1440]) {
		test.each(['user', 'moderator', 'admin'])(`%s: integration links at ${width}px`, role => {
			window.innerWidth = width;
			state.user = { isAdmin: role === 'admin', isModerator: role === 'moderator' };
			const view = mount(Connect);
			expect(view.container.querySelector('a[href="/settings/apps"]')).not.toBeNull();
			expect(view.container.querySelector('a[href="/settings/webhook/edit/existing"]')).not.toBeNull();
			for (const path of ['/settings/webhook/new', '/api-console']) {
				expect(!!view.container.querySelector(`a[href="${path}"]`)).toBe(role === 'admin');
			}
			expect(!!view.queryByText(i18n.ts.generateAccessToken)).toBe(role === 'admin');
		});
	}

	test('existing app/token can still be revoked', async () => {
		state.user = { isAdmin: false, isModerator: false };
		state.api.mockResolvedValue(undefined);
		const view = mount(Apps);
		await fireEvent.click(view.getByText(i18n.ts.delete));
		expect(state.api).toHaveBeenCalledWith('i/revoke-token', { tokenId: 'existing' });
		await waitFor(() => expect(state.reload).toHaveBeenCalled());
	});

	test('existing webhook can still be disabled and deleted', async () => {
		state.user = { isAdmin: false, isModerator: false };
		state.api.mockResolvedValue({ id: 'existing', name: 'Existing webhook', url: 'https://example.test/hook', secret: 'test-only', active: true, on: ['note'] });
		const view = mount(Webhook, { webhookId: 'existing' });
		await waitFor(() => expect(view.queryByText(i18n.ts.save)).not.toBeNull());
		await fireEvent.click(view.getByLabelText(i18n.ts._webhookSettings.active));
		await fireEvent.click(view.getByText(i18n.ts.save));
		expect(state.dialogApi).toHaveBeenCalledWith('i/webhooks/update', expect.objectContaining({ webhookId: 'existing', active: false, on: ['note'] }));
		await fireEvent.click(view.getByText(i18n.ts.delete));
		await waitFor(() => expect(state.dialogApi).toHaveBeenCalledWith('i/webhooks/delete', { webhookId: 'existing' }));
	});

	test.each(['user', 'moderator', 'admin'])('%s: external themes install but plugins require admin', async role => {
		state.user = { isAdmin: role === 'admin', isModerator: role === 'moderator' };
		window.history.replaceState(null, '', '/install-extensions?url=https%3A%2F%2Fexample.test%2Ftheme&hash=test');
		const theme = JSON.stringify({ id: 'new-theme', name: 'School', base: 'light', props: {} });
		state.api.mockResolvedValue({ type: 'theme', data: theme });
		const view = mount(Installer);
		await waitFor(() => expect(view.queryByText('Install theme')).not.toBeNull());
		await fireEvent.click(view.getByText('Install theme'));
		expect(state.installTheme).toHaveBeenCalledWith(theme);
		view.unmount();

		state.api.mockResolvedValue({ type: 'plugin', data: 'untrusted script' });
		state.parsePlugin.mockResolvedValue({ name: 'Plugin', author: 'Tester', version: '1' });
		const pluginView = mount(Installer);
		if (role === 'admin') {
			await waitFor(() => expect(pluginView.queryByText('Install plugin')).not.toBeNull());
			await fireEvent.click(pluginView.getByText('Install plugin'));
			expect(state.installPlugin).toHaveBeenCalled();
		} else {
			await waitFor(() => expect(pluginView.queryByText(i18n.ts._externalResourceInstaller._errors._resourceTypeNotSupported.title)).not.toBeNull());
			expect(state.parsePlugin).not.toHaveBeenCalled();
			expect(state.installPlugin).not.toHaveBeenCalled();
		}
	});
});
