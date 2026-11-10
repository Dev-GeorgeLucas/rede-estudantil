/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// New paths bypass the previous seven-day static-asset cache without deleting user data.
export const brand = {
	name: 'IFEED',
	symbol: '/static-assets/ifeed-v1/symbol.svg',
	logo: '/static-assets/ifeed-v1/horizontal.svg',
	logoDark: '/static-assets/ifeed-v1/horizontal-dark.svg',
} as const;
