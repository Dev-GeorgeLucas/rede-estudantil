/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { expect, test, vi } from 'vitest';
import { preferState } from '../setup.unit.js';
import { mainBoot } from '@/boot/main-boot.js';
import { restoreFromCloudBackup } from '@/preferences/utility.js';

const boot = vi.hoisted(() => ({ user: null as object | null, component: '', deckLoaded: vi.fn(), api: vi.fn(), reload: vi.fn() }));
vi.mock('@@/js/config.js', () => ({ get ui() { return localStorage.getItem('ui'); } }));
vi.mock('@/i.js', () => ({ get $i() { return boot.user; } }));
vi.mock('@/boot/common.js', () => ({ common: async (setup: () => Promise<{ _component: { name: string } }>) => {
	boot.component = (await setup())._component.name;
	// Stop after selecting the root, before unrelated background services start.
	throw new Error('root selected');
} }));
vi.mock('@/ui/universal.vue', () => ({ default: { name: 'Standard' } }));
vi.mock('@/ui/visitor.vue', () => ({ default: { name: 'Visitor' } }));
vi.mock('@/ui/deck.vue', () => { boot.deckLoaded(); return { default: { name: 'Deck' } }; });
vi.mock('@/ui/zen.vue', () => ({ default: { name: 'Zen' } }));
vi.mock('@/os.js', () => ({ alert: vi.fn(), confirm: vi.fn(), popup: vi.fn(), post: vi.fn(), select: async () => ({ result: 'saved' }) }));
vi.mock('@/stream.js', () => ({ useStream: vi.fn() }));
vi.mock('@/utility/sound.js', () => ({}));
vi.mock('@/instance.js', () => ({ instance: {} }));
vi.mock('@/store.js', () => ({ store: { set: vi.fn() } }));
vi.mock('@/utility/reaction-picker.js', () => ({ reactionPicker: {} }));
vi.mock('@/utility/emoji-picker.js', () => ({ emojiPicker: {} }));
vi.mock('@/local-storage.js', () => ({ miLocalStorage: localStorage }));
vi.mock('@/utility/achievements.js', () => ({ claimAchievement: vi.fn(), claimedAchievements: [] }));
vi.mock('@/utility/initialize-sw.js', () => ({ initializeSw: vi.fn() }));
vi.mock('@/router.js', () => ({ mainRouter: {} }));
vi.mock('@/custom-emojis.js', () => ({ addCustomEmoji: vi.fn(), removeCustomEmojis: vi.fn(), updateCustomEmojis: vi.fn() }));
vi.mock('@/accounts.js', () => ({ updateCurrentAccountPartial: vi.fn() }));
vi.mock('@/utility/unison-reload.js', () => ({ unisonReload: boot.reload }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: boot.api }));
vi.mock('@/utility/copy-to-clipboard.js', () => ({ copyToClipboard: vi.fn() }));

test.each([true, false])('boot with a saved or restored Deck uses the standard root (logged in: %s)', async loggedIn => {
	boot.user = loggedIn ? {} : null;
	const layout = { saved: { columns: [{ type: 'antenna', antennaId: 'existing' }] } };
	preferState['deck.profiles'] = structuredClone(layout);
	preferState['deck.useSimpleUiForNonRootPages'] = true;
	localStorage.setItem('ui', 'deck');
	localStorage.setItem('ui_temp', 'deck');
	for (const path of ['/', '/settings', '/?ui=deck', '/?zen', '/?ui=zen']) {
		window.history.replaceState(null, '', path);
		await expect(mainBoot()).rejects.toThrow('root selected');
		expect(boot.component).toBe(loggedIn ? 'Standard' : 'Visitor');
		expect(localStorage.getItem('ui')).toBe('deck');
		expect(localStorage.getItem('ui_temp')).toBe('deck');
		expect(preferState['deck.profiles']).toEqual(layout);
	}
	expect(boot.deckLoaded).not.toHaveBeenCalled();
});

test('cloud backup restoration preserves hidden preferences and cannot activate Deck at the next boot', async () => {
	boot.user = {};
	const backup = {
		id: 'old-profile', name: 'saved', type: 'main', version: '2026.9.1', modifiedAt: 1,
		preferences: {
			'deck.profiles': [[{}, { saved: { columns: [{ type: 'antenna', antennaId: 'existing' }] } }, {}]],
			widgets: [[{}, [{ name: 'rss', id: 'rss', data: { url: 'https://example.test/feed' } }], {}]],
			statusbars: [[{}, [{ type: 'rss', id: 'status', props: { url: 'https://example.test/feed' } }], {}]],
			menu: [[{}, ['ui', 'antennas', 'pages', 'play', 'gallery', 'chat'], {}]],
		},
	};
	boot.api.mockResolvedValueOnce(['saved']).mockResolvedValueOnce(backup);
	localStorage.setItem('ui', 'deck');
	await restoreFromCloudBackup();
	expect(JSON.parse(localStorage.getItem('preferences')!)).toEqual(backup);
	expect(boot.reload).toHaveBeenCalledOnce();
	await expect(mainBoot()).rejects.toThrow('root selected');
	expect(boot.component).toBe('Standard');
	expect(localStorage.getItem('ui')).toBe('deck');
	expect(boot.deckLoaded).not.toHaveBeenCalled();
});
