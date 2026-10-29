/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, expect, test, vi } from 'vitest';
import { signout } from '@/signout.js';
import { globalEvents } from '@/events.js';
import { cloudBackup } from '@/preferences/utility.js';

vi.mock('@/i.js', () => ({ $i: { id: 'moderator', token: 'fake-token', isModerator: true } }));
vi.mock('@/preferences/utility.js', () => ({ cloudBackup: vi.fn() }));
vi.mock('@/store.js', () => ({ store: { s: { enablePreferencesAutoCloudBackup: true } } }));
vi.mock('@/os.js', () => ({ waiting: vi.fn() }));
vi.mock('@/utility/unison-reload.js', () => ({ unisonReload: vi.fn() }));
vi.mock('@/utility/idb-proxy.js', () => ({ clear: vi.fn() }));

afterEach(() => vi.restoreAllMocks());

test('a failed preference backup does not end the moderation session or erase credentials', async () => {
	const ended = vi.spyOn(globalEvents, 'emit');
	const clear = vi.spyOn(localStorage, 'clear');
	vi.mocked(cloudBackup).mockRejectedValueOnce(new Error('backup failed'));
	await expect(signout()).rejects.toThrow('backup failed');
	expect(ended).not.toHaveBeenCalledWith('accountChanging');
	expect(clear).not.toHaveBeenCalled();
});
