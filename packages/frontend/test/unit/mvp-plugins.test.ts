/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { preferState } from '../setup.unit.js';
import { abortPlugin, getPluginHandlers, installPlugin, launchPlugins, pluginLogs } from '@/plugin.js';
import type { Plugin } from '@/plugin.js';

const session = vi.hoisted(() => ({ user: null as null | { isAdmin: boolean; isModerator: boolean }, safe: false }));
vi.mock('@/i.js', () => ({ get $i() { return session.user; } }));
vi.mock('@@/js/config.js', () => ({ get isSafeMode() { return session.safe; } }));
vi.mock('@/store.js', () => ({ store: { s: { pluginTokens: {} }, set: vi.fn() } }));
vi.mock('@/os.js', () => ({ popupAsyncWithDialog: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));
vi.mock('@/aiscript/api.js', () => ({ createAiScriptEnv: () => ({}), aiScriptReadline: vi.fn() }));

const plugin: Plugin = {
	installId: 'legacy', name: 'Saved plugin', version: '1', active: true, configData: {},
	src: `Plugin:register:post_form_action("Compose", @(form, update) {})
Plugin:register:note_action("Note", @(note) {})
Plugin:register:user_action("User", @(user) {})
Plugin:register:note_view_interruptor(@(note) { note })
Plugin:register:note_post_interruptor(@(note) { note })
Plugin:register:page_view_interruptor(@(page) { page })`,
};

const hooks = ['post_form_action', 'note_action', 'user_action', 'note_view_interruptor', 'note_post_interruptor', 'page_view_interruptor'] as const;
afterEach(() => {
	abortPlugin(plugin);
	session.safe = false;
});

describe('MVP plugin execution', () => {
	test.each(['visitor', 'user', 'moderator', 'admin'])('%s: restored plugins only execute for administrators', async role => {
		session.user = role === 'visitor' ? null : { isAdmin: role === 'admin', isModerator: role === 'moderator' };
		preferState.plugins = [structuredClone(plugin)];
		await launchPlugins();
		for (const hook of hooks) expect(getPluginHandlers(hook)).toHaveLength(role === 'admin' ? 1 : 0);
		expect(pluginLogs.value.has(plugin.installId)).toBe(role === 'admin');
		expect(preferState.plugins).toEqual([plugin]);
		if (role !== 'admin') await expect(installPlugin(plugin.src!)).rejects.toThrow('unavailable');
		expect(preferState.plugins).toEqual([plugin]);
	});

	test('safe mode still suppresses plugins for administrators', async () => {
		session.user = { isAdmin: true, isModerator: false };
		session.safe = true;
		preferState.plugins = [structuredClone(plugin)];
		await launchPlugins();
		for (const hook of hooks) expect(getPluginHandlers(hook)).toEqual([]);
		expect(pluginLogs.value.size).toBe(0);
	});

	test('already registered handlers are not exposed to a non-admin session', async () => {
		session.user = { isAdmin: true, isModerator: false };
		preferState.plugins = [structuredClone(plugin)];
		await launchPlugins();
		session.user = { isAdmin: false, isModerator: false };
		for (const hook of hooks) expect(getPluginHandlers(hook)).toEqual([]);
	});
});
