<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<Teleport :to="container ?? 'body'" :disabled="!container">
	<div
		v-if="container || showing"
		ref="panel"
		:class="container ? $style.docked : $style.surface"
		:role="container ? undefined : 'dialog'"
		:aria-modal="container ? undefined : true"
		:aria-label="i18n.ts.widgets"
		@keydown.esc.stop="showing = false"
	>
		<div v-if="!container" class="_modalBg" @click="showing = false" @touchstart.passive="showing = false"></div>
		<div :class="container ? undefined : [$style.drawer, { [$style.animated]: prefer.s.animation }]">
			<button v-if="!container" ref="closeButton" class="_button" :class="$style.close" :aria-label="i18n.ts.close" @click="showing = false"><i class="ti ti-x" aria-hidden="true"></i></button>
			<XWidgets/>
		</div>
	</div>
</Teleport>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, useTemplateRef, watch } from 'vue';
import { i18n } from '@/i18n.js';
import { prefer } from '@/preferences.js';
import { focusTrap } from '@/utility/focus-trap.js';

const props = defineProps<{ container?: HTMLElement | null }>();
const showing = defineModel<boolean>({ default: false });
const panel = useTemplateRef('panel');
const closeButton = useTemplateRef('closeButton');
const drawerOpen = computed(() => showing.value && !props.container);
const XWidgets = defineAsyncComponent(() => import('./widgets.vue'));

// Teleport moves the same widget tree; switching presentation never mounts a second copy.
watch(() => props.container, container => {
	if (container) showing.value = false;
}, { flush: 'sync' });
watch(drawerOpen, (open, _, onCleanup) => {
	if (!open) return;
	const returnFocus = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
	let release = () => {};
	let cancelled = false;
	void nextTick(() => {
		if (cancelled || !panel.value) return;
		release = focusTrap(panel.value, true).release;
		closeButton.value?.focus();
	});
	onCleanup(() => {
		cancelled = true;
		// Release before Teleport changes parents, including when resizing into the column.
		release();
		if (returnFocus?.isConnected && returnFocus.getClientRects().length > 0) returnFocus.focus();
	});
}, { immediate: true, flush: 'pre' });
</script>

<style lang="scss" module>
.docked { min-width: 0; }
.surface { position: fixed; inset: 0; z-index: 1001; }
.drawer {
	position: fixed;
	inset: 0 auto 0 0;
	z-index: 1001;
	width: min(350px, 100vw);
	height: 100dvh;
	padding: var(--MI-margin) var(--MI-margin) calc(var(--MI-margin) + env(safe-area-inset-bottom, 0px));
	box-sizing: border-box;
	overflow: auto;
	overscroll-behavior: contain;
	background: var(--MI_THEME-bg);
}
.animated { animation: enter 300ms cubic-bezier(0.23, 1, 0.32, 1); }
.close {
	display: block;
	min-width: 44px;
	min-height: 44px;
	margin: 0 0 var(--MI-margin) auto;
	&:focus-visible { outline: 2px solid var(--MI_THEME-focus); outline-offset: -2px; }
}
@keyframes enter {
	from { opacity: 0; transform: translateX(-100%); }
	to { opacity: 1; transform: translateX(0); }
}
@media (prefers-reduced-motion: reduce) {
	.animated { animation: none; }
}
</style>
