/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render } from '@testing-library/vue';
import BrandLogo from '@/components/MkBrandLogo.vue';
import { brand } from '@@/js/branding.js';

const config = vi.hoisted(() => ({ name: 'Test instance', logoImageUrl: null as string | null }));
vi.mock('@/instance.js', () => ({ instance: config }));
afterEach(() => { cleanup(); config.logoImageUrl = null; });

test('supplies the extracted signatures with an accessible brand name', () => {
	const view = render(BrandLogo);
	expect(view.getAllByAltText(brand.name).map(element => element.getAttribute('src'))).toEqual([brand.logo, brand.logoDark]);
});

test('honors an explicit instance logo and keeps its accessible name', () => {
	config.logoImageUrl = '/custom-instance.svg';
	const view = render(BrandLogo);
	expect(view.getByRole('img', { name: config.name }).getAttribute('src')).toBe(config.logoImageUrl);
	expect(view.queryByAltText(brand.name)).toBeNull();
});
