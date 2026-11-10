<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="meta" :class="$style.root">
	<MkFeaturedPhotos :class="$style.bg"/>
	<div :class="$style.logoWrapper">
		<MkBrandLogo :class="$style.logo"/>
		<div :class="$style.poweredBy">Powered by <a href="https://misskey-hub.net/" target="_blank" rel="noopener noreferrer">Misskey</a></div>
	</div>
	<div :class="$style.contents">
		<MkVisitorDashboard/>
	</div>
</div>
</template>

<script lang="ts" setup>
import MkFeaturedPhotos from '@/components/MkFeaturedPhotos.vue';
import MkBrandLogo from '@/components/MkBrandLogo.vue';
import MkVisitorDashboard from '@/components/MkVisitorDashboard.vue';
import { instance as meta } from '@/instance.js';
</script>

<style lang="scss" module>
.root {
	height: 100cqh;
	overflow: auto;
	overscroll-behavior: contain;
}

.bg {
	position: fixed;
	top: 0;
	right: 0;
	width: 100vw;
	height: 100vh;
	// 固定レイヤがホイール操作を奪い、コンテンツ列以外の上でページをスクロールできなくなるのを防ぐ (issue #17680)
	pointer-events: none;
}

.logoWrapper {
	position: fixed;
	top: 36px;
	left: 36px;
	flex: auto;
	color: var(--MI_THEME-fg);
	background: var(--MI_THEME-panel);
	border-radius: var(--MI-radius);
	user-select: none;
}

.poweredBy {
	padding: 0 16px 12px;
	font-size: 0.8em;
}

.logo {
	width: 180px;

	@media (max-width: 450px) {
		width: 140px;
	}
}

.contents {
	position: relative;
	width: min(430px, calc(100% - 32px));
	margin: auto;
	padding: 156px 0 100px 0;
}
</style>
