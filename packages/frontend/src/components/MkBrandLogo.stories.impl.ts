/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { StoryObj } from '@storybook/vue3';
import MkBrandLogo from './MkBrandLogo.vue';

export const Default = {
	render: () => ({ components: { MkBrandLogo }, template: '<MkBrandLogo style="width: 240px"/>' }),
	parameters: { layout: 'centered' },
} satisfies StoryObj<typeof MkBrandLogo>;
