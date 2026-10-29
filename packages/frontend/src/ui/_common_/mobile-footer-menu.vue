<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div ref="rootEl" :class="$style.root">
	<button :class="$style.item" class="_button" :aria-label="moderation.state.authorized && (moderation.state.pending || moderation.state.error) ? `${i18n.ts.menu.trim()} — ${moderation.label.value}` : i18n.ts.menu.trim()" @click="drawerMenuShowing = true">
		<div :class="$style.itemInner">
			<i :class="$style.itemIcon" class="ti ti-menu-2" aria-hidden="true"></i><span v-if="moderation.state.authorized && (moderation.state.pending || moderation.state.error)" :class="$style.itemIndicator"><i :class="moderation.state.pending ? 'ti ti-alert-circle' : 'ti ti-cloud-off'" aria-hidden="true"></i></span><span v-else-if="menuIndicated" :class="$style.itemIndicator" class="_blink"><i class="_indicatorCircle"></i></span>
		</div>
	</button>

	<button v-tooltip="i18n.ts.timeline" :class="[$style.item, { [$style.active]: isFeed }]" class="_button" :aria-label="i18n.ts.timeline" :aria-current="isFeed ? 'page' : undefined" @click="mainRouter.push('/feed')">
		<div :class="$style.itemInner">
			<i :class="$style.itemIcon" class="ti ti-home"></i>
		</div>
	</button>

	<button :class="$style.item" class="_button" @click="mainRouter.push('/my/notifications')">
		<div :class="$style.itemInner">
			<i :class="$style.itemIcon" class="ti ti-bell"></i>
			<span v-if="$i?.hasUnreadNotification" :class="$style.itemIndicator" class="_blink">
				<span class="_indicateCounter" :class="$style.itemIndicateValueIcon">{{ $i.unreadNotificationsCount > 99 ? '99+' : $i.unreadNotificationsCount }}</span>
			</span>
		</div>
	</button>

	<button :class="$style.item" class="_button" @click="widgetsShowing = true">
		<div :class="$style.itemInner">
			<i :class="$style.itemIcon" class="ti ti-apps"></i>
		</div>
	</button>

	<button :class="[$style.item, $style.post]" class="_button" @click="os.post()">
		<div :class="$style.itemInner">
			<i :class="$style.itemIcon" class="ti ti-pencil"></i>
		</div>
	</button>
</div>
</template>

<script lang="ts" setup>
import { computed, ref, useTemplateRef, watch } from 'vue';
import { $i } from '@/i.js';
import { usePendingAbuseReports } from '@/composables/use-pending-abuse-reports.js';
import * as os from '@/os.js';
import { mainRouter } from '@/router.js';
import { i18n } from '@/i18n.js';
import { navbarItemDef } from '@/navbar.js';

const drawerMenuShowing = defineModel<boolean>('drawerMenuShowing');
const widgetsShowing = defineModel<boolean>('widgetsShowing');

const moderation = usePendingAbuseReports();

const rootEl = useTemplateRef('rootEl');
const isFeed = computed(() => mainRouter.currentRoute.value.path === '/feed');

const menuIndicated = computed(() => {
	for (const def in navbarItemDef) {
		if (def === 'notifications') continue; // 通知は下にボタンとして表示されてるから
		if (navbarItemDef[def].indicated) return true;
	}
	return false;
});

const rootElHeight = ref(0);

watch(rootEl, () => {
	if (rootEl.value) {
		rootElHeight.value = rootEl.value.offsetHeight;
		window.document.body.style.setProperty('--MI-minBottomSpacing', 'var(--MI-minBottomSpacingMobile)');
	} else {
		rootElHeight.value = 0;
		window.document.body.style.setProperty('--MI-minBottomSpacing', '0px');
	}
}, {
	immediate: true,
});
</script>

<style lang="scss" module>
.root {
	position: relative;
	z-index: 1;
	padding-bottom: env(safe-area-inset-bottom, 0px);
	display: grid;
	grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
	width: 100%;
	box-sizing: border-box;
	background: var(--MI_THEME-navBg);
	color: var(--MI_THEME-navFg);
	border-top: solid 0.5px var(--MI_THEME-divider);
}

.active {
	color: var(--MI_THEME-accent);
}

.item {
	&:focus-visible { outline: 2px solid var(--MI_THEME-focus); outline-offset: -2px; }
	padding: 12px 0;

	&:first-child {
		padding-left: 12px;
	}

	&:last-child {
		padding-right: 12px;
	}

	&.post {
		.itemInner {
			background: linear-gradient(90deg, var(--MI_THEME-buttonGradateA), var(--MI_THEME-buttonGradateB));
			color: var(--MI_THEME-fgOnAccent);

			&:hover {
				background: linear-gradient(90deg, hsl(from var(--MI_THEME-accent) h s calc(l + 5)), hsl(from var(--MI_THEME-accent) h s calc(l + 5)));
			}

			&:active {
				background: linear-gradient(90deg, hsl(from var(--MI_THEME-accent) h s calc(l + 5)), hsl(from var(--MI_THEME-accent) h s calc(l + 5)));
			}
		}
	}
}

.itemInner {
	position: relative;
	padding: 0;
	aspect-ratio: 1;
	width: 100%;
	max-width: 42px;
	margin: auto;
	align-content: center;
	border-radius: 100%;

	&:hover {
		background: var(--MI_THEME-panelHighlight);
	}

	&:active {
		background: var(--MI_THEME-panelHighlight);
	}
}

.itemIcon {
	font-size: 15px;
}

.itemIndicator {
	position: absolute;
	bottom: -4px;
	left: 0;
	right: 0;
	color: var(--MI_THEME-indicator);
	font-size: 10px;
	pointer-events: none;

	&:has(.itemIndicateValueIcon) {
		animation: none;
		font-size: 8px;
	}
}
</style>
