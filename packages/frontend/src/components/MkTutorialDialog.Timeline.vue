<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_gaps">
	<div><i class="ti ti-home"></i> <b>{{ i18n.ts.following }}</b></div>
	<div>{{ i18n.ts._timelineDescription.home }}</div>
	<MkA to="/explore" class="_link"><i class="ti ti-hash"></i> {{ i18n.ts.explore }}</MkA>
</div>
</template>

<script setup lang="ts">
import { i18n } from '@/i18n.js';
</script>

<style lang="scss" module>
.exampleNoteRoot {
	border-radius: var(--MI-radius);
	border: var(--MI_THEME-panelBorder);
	background: var(--MI_THEME-panel);
}

.divider {
	height: 1px;
	background: var(--MI_THEME-divider);
}

.image {
	max-width: 300px;
	margin: 0 auto;
}

.post {
	position: relative;
	display: block;
	width: 100%;
	height: 40px;
	color: var(--MI_THEME-fgOnAccent);
	font-weight: bold;
	text-align: left;

	&::before {
		content: "";
		display: block;
		width: calc(100% - 38px);
		height: 100%;
		margin: auto;
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--MI_THEME-buttonGradateA), var(--MI_THEME-buttonGradateB));
	}

}

.postIcon {
	position: relative;
	margin-left: 30px;
	margin-right: 8px;
	width: 32px;
}

.postText {
	position: relative;
	line-height: 40px;
}
</style>
