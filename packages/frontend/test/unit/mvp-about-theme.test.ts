/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/vue';
import About from '@/pages/about.vue';
import ThemeEditor from '@/pages/theme-editor.vue';
import { i18n } from '@/i18n.js';

const session = vi.hoisted(() => ({ user: null as null | { isAdmin: boolean; isModerator: boolean; username: string } }));
vi.mock('@/i.js', () => ({
	get $i() { return session.user; },
	get iAmModerator() { return !!(session.user?.isAdmin || session.user?.isModerator); },
	ensureSignin: () => session.user,
}));
vi.mock('@/page.js', () => ({ definePage: vi.fn() }));
vi.mock('@/instance.js', () => ({ instance: { federation: 'all' } }));
vi.mock('@/utility/achievements.js', () => ({ claimAchievement: vi.fn() }));
vi.mock('@/pages/about.overview.vue', () => ({ __esModule: true, default: { template: '<div>Overview content</div>' } }));
vi.mock('@/pages/about.emojis.vue', () => ({ __esModule: true, default: { template: '<div>Emojis content</div>' } }));
vi.mock('@/components/MkInstanceStats.vue', () => ({ __esModule: true, default: { template: '<div>Technical charts</div>' } }));
vi.mock('@/theme.js', () => ({ themeManager: { previewTheme: vi.fn() } }));
vi.mock('@/store.js', () => ({ store: { s: {} } }));
vi.mock('@/composables/use-leave-guard.js', () => ({ useLeaveGuard: vi.fn() }));
vi.mock('@/os.js', () => ({}));
vi.mock('@/components/MkFolder.vue', () => ({ default: { template: '<div><slot/></div>' } }));
vi.mock('@/components/MkButton.vue', () => ({ default: { template: '<button><slot/></button>' } }));
vi.mock('@/components/MkCodeEditor.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkTextarea.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/MkPreview.vue', () => ({ default: { template: '<div>Theme sample</div>' } }));
vi.mock('@/components/MkModalWindow.vue', () => ({ default: {
	emits: ['close', 'closed'],
	methods: { close(this: { $emit: (event: 'closed') => void }) { this.$emit('closed'); } },
	template: '<div role="dialog"><button @click="$emit(\'close\')">Close preview</button><slot/></div>',
} }));

const global = { components: { PageWithHeader: {
	props: ['actions', 'tabs', 'tab'], emits: ['update:tab'],
	template: '<div><button v-for="action in actions" @click="action.handler">{{ action.text }}</button><button v-for="item in tabs" @click="$emit(\'update:tab\', item.key)">{{ item.title }}</button><slot/></div>',
} } };
afterEach(cleanup);

test.each(['visitor', 'user', 'moderator', 'admin'])('%s: old chart hashes resolve to overview unless admin', async role => {
	session.user = role === 'visitor' ? null : { isAdmin: role === 'admin', isModerator: role === 'moderator', username: 'student' };
	const view = render(About, { props: { initialTab: 'charts' }, global });
	await waitFor(() => expect(view.queryByText(role === 'admin' ? 'Technical charts' : 'Overview content')).not.toBeNull());
	expect(!!view.queryByText(i18n.ts.charts)).toBe(role === 'admin');
	await view.rerender({ initialTab: 'emojis' });
	await waitFor(() => expect(view.queryByText('Emojis content')).not.toBeNull());
	await view.rerender({ initialTab: 'charts' });
	await waitFor(() => expect(view.queryByText(role === 'admin' ? 'Technical charts' : 'Overview content')).not.toBeNull());
});

test('theme editor opens and closes its sample without using the restricted preview route', async () => {
	session.user = { isAdmin: false, isModerator: false, username: 'student' };
	const view = render(ThemeEditor, { global });
	await fireEvent.click(view.getByText(i18n.ts.preview));
	expect(view.queryByText('Theme sample')).not.toBeNull();
	await fireEvent.click(view.getByText('Close preview'));
	expect(view.queryByRole('dialog')).toBeNull();
});
