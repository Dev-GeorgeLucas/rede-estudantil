/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import light from '@@/themes/l-ifeed.json5';
import dark from '@@/themes/d-ifeed.json5';
import { parseThemeCode } from './theme.js';
import type { Theme } from './theme.js';

// Resolve defaults without turning an instance fallback into a saved personal choice.
export function defaultTheme(mode: 'light' | 'dark', instanceTheme?: string | null): Theme {
	if (instanceTheme) {
		try {
			const theme = parseThemeCode(instanceTheme);
			if (theme.base === mode) return theme;
		} catch { /* Invalid instance branding must not prevent the application from booting. */ }
	}
	return mode === 'dark' ? dark : light;
}

export function resolveTheme(mode: 'light' | 'dark', preference?: Theme | null, instanceTheme?: string | null): Theme {
	return preference ?? defaultTheme(mode, instanceTheme);
}
