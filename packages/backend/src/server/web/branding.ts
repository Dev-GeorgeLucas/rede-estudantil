/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { MiMeta } from '@/models/Meta.js';

export const defaultThemeColor = '#23732E';
export const brandAssets = {
	favicon: '/static-assets/ifeed-v1/favicon.ico',
	appleTouch: '/static-assets/ifeed-v1/apple-touch-icon.png',
	symbol: '/static-assets/ifeed-v1/symbol.svg',
	splash: '/static-assets/ifeed-v1/splash.png',
	icon192: '/static-assets/ifeed-v1/icon-192.png',
	icon512: '/static-assets/ifeed-v1/icon-512.png',
	maskable192: '/static-assets/ifeed-v1/maskable-192.png',
	maskable512: '/static-assets/ifeed-v1/maskable-512.png',
} as const;

type ManifestBranding = Pick<MiMeta, 'name' | 'shortName' | 'themeColor' | 'app192IconUrl' | 'app512IconUrl' | 'manifestJsonOverride'>;

export function buildManifest(meta: ManifestBranding) {
	let manifest = {
		// 空文字列の場合右辺を使いたいため
		// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
		'short_name': meta.shortName || meta.name || 'IFEED',
		// 空文字列の場合右辺を使いたいため
		// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
		'name': meta.name || 'IFEED',
		'start_url': '/',
		'display': 'standalone',
		'background_color': '#F2F4F5',
		// 空文字列の場合右辺を使いたいため
		// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
		'theme_color': meta.themeColor || defaultThemeColor,
		'icons': [{
			// 空文字列の場合右辺を使いたいため
			// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
			'src': meta.app192IconUrl || brandAssets.maskable192,
			'sizes': '192x192',
			'type': 'image/png',
			'purpose': 'maskable',
		}, {
			// 空文字列の場合右辺を使いたいため
			// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
			'src': meta.app512IconUrl || brandAssets.maskable512,
			'sizes': '512x512',
			'type': 'image/png',
			'purpose': 'maskable',
		}, {
			'src': meta.app192IconUrl || brandAssets.icon192,
			'sizes': '192x192',
			'type': 'image/png',
			'purpose': 'any',
		}, {
			'src': meta.app512IconUrl || brandAssets.icon512,
			'sizes': '512x512',
			'type': 'image/png',
			'purpose': 'any',
		}, {
			'src': brandAssets.splash,
			'sizes': '300x300',
			'type': 'image/png',
			'purpose': 'any',
		}],
		'share_target': {
			'action': '/share/',
			'method': 'GET',
			'enctype': 'application/x-www-form-urlencoded',
			'params': {
				'title': 'title',
				'text': 'text',
				'url': 'url',
			},
		},
		'shortcuts': [{
			'name': 'Safemode',
			'url': '/?safemode=true',
		}],
	};

	manifest = {
		...manifest,
		...JSON.parse(meta.manifestJsonOverride === '' ? '{}' : meta.manifestJsonOverride),
	};
	return manifest;
}
