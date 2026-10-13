/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { expect, test, vi } from 'vitest';
import type { PossiblyNonNormalizedPreferencesProfile, StorageProvider } from '@/preferences/manager.js';

const device = vi.hoisted(() => ({ kind: 'desktop' }));
vi.mock('@/utility/device-kind.js', () => ({ get DEFAULT_DEVICE_KIND() { return device.kind; } }));
vi.mock('@/os.js', () => ({}));

test.each(['desktop', 'smartphone', 'tablet'])('%s: default fits the device and saved Enter preferences stay intact', async kind => {
	device.kind = kind;
	vi.resetModules();
	const { PreferencesManager, getInitialPrefValue } = await import('@/preferences/manager.js');
	expect(getInitialPrefValue('chat.sendOnEnter')).toBe(kind === 'desktop');
	for (const saved of [undefined, false, true]) {
		const preferences: PossiblyNonNormalizedPreferencesProfile['preferences'] = {};
		if (saved !== undefined) preferences['chat.sendOnEnter'] = [[{}, saved, {}]];
		const io: StorageProvider = {
			load: () => ({ id: 'test', name: 'Test', version: '2026.9.1', type: 'main', modifiedAt: 0,
				preferences,
			}),
			save: vi.fn(), cloudGetBulk: vi.fn(async () => ({})), cloudGet: vi.fn(async () => null), cloudSet: vi.fn(),
		};
		const manager = new PreferencesManager(io, null);
		await manager.cloudReady;
		expect(manager.s['chat.sendOnEnter']).toBe(saved ?? (kind === 'desktop'));
		if (saved !== undefined) expect(manager.profile.preferences['chat.sendOnEnter'][0][1]).toBe(saved);
	}
});
