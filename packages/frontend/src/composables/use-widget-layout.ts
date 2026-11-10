/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { computed, onScopeDispose, ref } from 'vue';

export function useWidgetLayout(isPhone: () => boolean, needsWideArea: () => boolean) {
	const width = ref(window.innerWidth);
	const update = () => { width.value = window.innerWidth; };
	window.addEventListener('resize', update, { passive: true });
	onScopeDispose(() => window.removeEventListener('resize', update));

	const isMobile = computed(() => isPhone() || width.value <= 500);
	const showWidgetsSide = computed(() => !isMobile.value && width.value >= 1100 && !needsWideArea());
	const widgetsShowing = ref(false);

	return { isMobile, showWidgetsSide, widgetsShowing };
}
