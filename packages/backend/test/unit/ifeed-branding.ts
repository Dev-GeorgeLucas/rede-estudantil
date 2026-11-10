/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { readFile } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import sharp from 'sharp';
import { brandAssets, buildManifest } from '@/server/web/branding.js';
import { Layout } from '@/server/web/views/base.js';
import { Splash } from '@/server/web/views/_splash.js';
import type { CommonData } from '@/server/web/views/_.js';

const meta = { shortName: null, name: null, themeColor: null, app192IconUrl: null, app512IconUrl: null, manifestJsonOverride: '' };

describe('IFEED web identity', () => {
	test('manifest preserves launch/share behavior and offers separate maskable/any compositions', () => {
		const result = buildManifest(meta);
		expect(result).toMatchObject({ name: 'IFEED', short_name: 'IFEED', start_url: '/', display: 'standalone' });
		expect(result.share_target).toMatchObject({ action: '/share/', method: 'GET' });
		expect(result.icons.filter((icon: { purpose: string }) => icon.purpose === 'maskable')).toHaveLength(2);
		expect(result.icons.filter((icon: { purpose: string }) => icon.purpose === 'any')).toHaveLength(3);
	});

	test('custom instance identity and explicit manifest overrides retain precedence without mutation', () => {
		const custom = { ...meta, name: 'Example', shortName: 'Ex', app192IconUrl: '/example-192.png', app512IconUrl: '/example-512.png', themeColor: '#123456' };
		const before = structuredClone(custom);
		expect(buildManifest(custom)).toMatchObject({ name: custom.name, short_name: custom.shortName, theme_color: custom.themeColor, icons: expect.arrayContaining([expect.objectContaining({ src: custom.app192IconUrl }), expect.objectContaining({ src: custom.app512IconUrl })]) });
		expect(buildManifest({ ...custom, manifestJsonOverride: '{"name":"Override","icons":[]}' })).toMatchObject({ name: 'Override', icons: [] });
		expect(custom).toEqual(before);
	});

	test.each([['appleTouch', 180], ['icon192', 192], ['icon512', 512], ['maskable192', 192], ['maskable512', 512], ['splash', 300]] as const)('%s has its advertised dimensions', async (key, size) => {
		const file = new URL(`../../assets/${brandAssets[key].replace('/static-assets/', '')}`, import.meta.url);
		const metadata = await sharp(await readFile(file)).metadata();
		expect([metadata.width, metadata.height]).toEqual([size, size]);
	});

	test('HTML uses new cache paths and keeps configured icons intact', () => {
		const props = { config: { url: 'http://127.0.0.1' }, instanceName: 'IFEED', instanceUrl: 'http://127.0.0.1', version: 'test', langs: [], frontendViteFiles: null } as unknown as CommonData;
		const html = String(Layout(props));
		expect(html).toContain(brandAssets.favicon);
		expect(html).toContain(brandAssets.appleTouch);
		expect(html).toContain('/manifest.json?v=ifeed-v1');
		expect(String(Layout({ ...props, icon: '/custom-icon.png', appleTouchIcon: '/custom-apple.png' }))).toContain('/custom-apple.png');
		expect(String(Splash({ icon: '/custom-icon.png' }))).toContain('/custom-icon.png');
	});

	test('favicon contains independently decodable PNG frames for small and high-density browser tabs', async () => {
		const ico = await readFile(new URL('../../assets/ifeed-v1/favicon.ico', import.meta.url));
		expect(ico.readUInt16LE(0)).toBe(0);
		expect(ico.readUInt16LE(2)).toBe(1);
		const sizes: number[] = [];
		for (let index = 0; index < ico.readUInt16LE(4); index++) {
			const entry = 6 + index * 16;
			const length = ico.readUInt32LE(entry + 8);
			const offset = ico.readUInt32LE(entry + 12);
			expect(offset + length).toBeLessThanOrEqual(ico.length);
			const image = await sharp(ico.subarray(offset, offset + length)).metadata();
			expect(image.format).toBe('png');
			expect(image.width).toBe(image.height);
			sizes.push(image.width!);
		}
		expect(sizes.sort((a, b) => a - b)).toEqual([16, 32, 48, 64]);
	});

	test('maskable artwork fits completely inside the circular safe area', async () => {
		const data = await sharp(new URL('../../assets/ifeed-v1/maskable-512.png', import.meta.url).pathname).removeAlpha().raw().toBuffer();
		let colored = 0;
		let maximumRadius = 0;
		for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
			const offset = (y * 512 + x) * 3;
			if (data[offset] < 220 || data[offset + 1] < 220 || data[offset + 2] < 220) {
				colored++;
				maximumRadius = Math.max(maximumRadius, Math.hypot(x - 255.5, y - 255.5));
			}
		}
		expect(colored).toBeGreaterThan(10000);
		expect(maximumRadius).toBeLessThan(512 * 0.4);
	});
});
