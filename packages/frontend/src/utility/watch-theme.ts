/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { watch } from 'vue';
import { defaultTheme, resolveTheme } from '@@/js/default-theme.js';
import type { Ref } from 'vue';
import type { Theme } from '@@/js/theme.js';

export function watchTheme(
	darkMode: Ref<boolean>, light: Ref<Theme | null>, dark: Ref<Theme | null>,
	instance: { defaultLightTheme?: string | null; defaultDarkTheme?: string | null },
	safeMode: boolean, apply: (theme: Theme) => void,
) {
	// Pizzax/PreferencesManager expose reactive refs in .r; their .s snapshots are not reactive.
	return watch([darkMode, light, dark, () => instance.defaultLightTheme, () => instance.defaultDarkTheme],
		([isDark, lightPreference, darkPreference, instanceLight, instanceDark]) => {
			const mode = isDark ? 'dark' : 'light';
			apply(safeMode ? defaultTheme(mode) : resolveTheme(mode,
				isDark ? darkPreference : lightPreference, isDark ? instanceDark : instanceLight));
		}, { immediate: true });
}
