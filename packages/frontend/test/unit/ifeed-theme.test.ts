/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, test, vi } from 'vitest';
import tinycolor from 'tinycolor2';
import { nextTick, reactive, ref } from 'vue';
import { watchTheme } from '@/utility/watch-theme.js';
import { defaultTheme, resolveTheme } from '@@/js/default-theme.js';
import { compile, getBuiltinThemes } from '@@/js/theme.js';
import lightBase from '@@/themes/_light.json5';
import darkBase from '@@/themes/_dark.json5';
import oldLight from '@@/themes/l-light.json5';
import oldDark from '@@/themes/d-green-lime.json5';
import type { Theme } from '@@/js/theme.js';
import type { PossiblyNonNormalizedPreferencesProfile, StorageProvider } from '@/preferences/manager.js';

vi.mock('@/os.js', () => ({}));

describe('IFEED theme defaults', () => {
	test('adds both themes while retaining all previous built-in themes', async () => {
		const themes = await getBuiltinThemes();
		expect(themes).toHaveLength(21);
		expect(themes.map(theme => theme.id)).toContain(oldLight.id);
		expect(themes.map(theme => theme.id)).toContain(oldDark.id);
		for (const mode of ['light', 'dark'] as const) expect(themes.find(theme => theme.id === defaultTheme(mode).id)?.base).toBe(mode);
		expect(new Set(themes.map(theme => theme.id)).size).toBe(themes.length);
	});

	test.each(['light', 'dark'] as const)('%s: explicit old/custom themes outrank instance and code defaults without mutation', mode => {
		const old = mode === 'light' ? oldLight : oldDark;
		const custom: Theme = { ...structuredClone(old), id: 'personal', name: 'Personal', props: { ...old.props, accent: '#123456' } };
		const code = JSON.stringify({ ...old, id: 'instance' });
		for (const preference of [old, custom]) {
			const before = structuredClone(preference);
			expect(resolveTheme(mode, preference, code)).toBe(preference);
			expect(preference).toEqual(before);
		}
		expect(resolveTheme(mode, null, code).id).toBe('instance');
		expect(resolveTheme(mode, null, null).name).toBe(mode === 'light' ? 'IFEED Claro' : 'IFEED Escuro');
		for (const invalid of ['{', '{}', JSON.stringify({ ...old, base: mode === 'light' ? 'dark' : 'light' })]) expect(resolveTheme(mode, null, invalid)).toBe(defaultTheme(mode));
	});

	test.each([undefined, true, false])('stored follow-system preference %s and explicit choices survive profile loading', async followSystem => {
		const { PreferencesManager } = await import('@/preferences/manager.js');
		const preferences: PossiblyNonNormalizedPreferencesProfile['preferences'] = {
			lightTheme: [[{}, oldLight, {}]], darkTheme: [[{}, oldDark, {}]], themes: [[{}, [{ ...oldLight, id: 'personal' }], {}]],
		};
		if (followSystem !== undefined) preferences.syncDeviceDarkMode = [[{}, followSystem, {}]];
		const io: StorageProvider = {
			load: () => ({ id: 'test', name: 'Test', version: '2026.9.1', type: 'main', modifiedAt: 0, preferences }),
			save: vi.fn(), cloudGetBulk: vi.fn(async () => ({})), cloudGet: vi.fn(async () => null), cloudSet: vi.fn(),
		};
		const manager = new PreferencesManager(io, null);
		await manager.cloudReady;
		expect(manager.s.syncDeviceDarkMode).toBe(followSystem ?? true);
		expect(resolveTheme('light', manager.s.lightTheme).id).toBe(oldLight.id);
		expect(resolveTheme('dark', manager.s.darkTheme).id).toBe(oldDark.id);
		expect(manager.s.themes[0].id).toBe('personal');
	});

	test('unset personal preferences resolve to IFEED without saving a personal theme', async () => {
		const { PreferencesManager } = await import('@/preferences/manager.js');
		const io: StorageProvider = { load: () => null, save: vi.fn(), cloudGetBulk: vi.fn(async () => ({})), cloudGet: vi.fn(async () => null), cloudSet: vi.fn() };
		const manager = new PreferencesManager(io, null);
		await manager.cloudReady;
		for (const mode of ['light', 'dark'] as const) {
			expect(resolveTheme(mode, manager.s[`${mode}Theme`]).id).toBe(defaultTheme(mode).id);
			expect(manager.s[`${mode}Theme`]).toBeNull();
		}
	});
});

for (const mode of ['light', 'dark'] as const) {
	test(`${mode}: compiled text and controls meet contrast requirements`, () => {
		const base = mode === 'light' ? lightBase : darkBase;
		const theme = defaultTheme(mode);
		const colors = compile({ ...theme, props: { ...base.props, ...theme.props } });
		for (const [foreground, background] of [
			['fg', 'bg'], ['fg', 'panel'], ['fg', 'buttonBg'], ['fg', 'buttonHoverBg'],
			['link', 'panel'], ['link', 'bg'], ['accent', 'accentedBg'], ['mention', 'panel'],
			['error', 'panel'], ['success', 'panel'], ['warn', 'panel'], ['love', 'panel'],
			['fgOnAccent', 'accent'], ['fgOnAccent', 'buttonGradateB'], ['infoFg', 'infoBg'], ['infoWarnFg', 'infoWarnBg'],
		]) expect(tinycolor.readability(colors[foreground], colors[background]), `${foreground}/${background}`).toBeGreaterThanOrEqual(4.5);
		for (const background of ['panel', 'bg', 'buttonBg']) expect(tinycolor.readability(colors.focus, colors[background]), `focus/${background}`).toBeGreaterThanOrEqual(3);
		expect(tinycolor.readability(colors.inputBorder, colors.panel)).toBeGreaterThanOrEqual(3);
		expect(colors.error).not.toBe(colors.success);
		expect(colors.warn).not.toBe(colors.success);
	});
}

test('runtime mode, personal selection and asynchronous instance defaults update without writing preferences', async () => {
	const darkMode = ref(false);
	const light = ref<Theme | null>(null);
	const dark = ref<Theme | null>(null);
	const instance = reactive({ defaultLightTheme: null as string | null, defaultDarkTheme: null as string | null });
	const apply = vi.fn();
	const stop = watchTheme(darkMode, light, dark, instance, false, apply);
	expect(apply).toHaveBeenLastCalledWith(defaultTheme('light'));
	darkMode.value = true; await nextTick();
	expect(apply).toHaveBeenLastCalledWith(defaultTheme('dark'));
	dark.value = oldDark; await nextTick();
	expect(apply).toHaveBeenLastCalledWith(oldDark);
	instance.defaultLightTheme = JSON.stringify(oldLight); await nextTick();
	expect(apply).toHaveBeenLastCalledWith(oldDark);
	darkMode.value = false; await nextTick();
	expect(apply).toHaveBeenLastCalledWith(oldLight);
	expect(light.value).toBeNull();
	light.value = { ...oldLight, id: 'personal' }; await nextTick();
	instance.defaultLightTheme = JSON.stringify(defaultTheme('light')); await nextTick();
	expect(apply.mock.calls.at(-1)?.[0].id).toBe('personal');
	stop();
});
