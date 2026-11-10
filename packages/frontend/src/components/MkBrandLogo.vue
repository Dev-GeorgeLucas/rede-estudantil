<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<span :class="$style.root">
	<img v-if="instance.logoImageUrl" :src="instance.logoImageUrl" :alt="instance.name || brand.name"/>
	<template v-else>
		<img :src="brand.logo" :alt="brand.name" :class="$style.light"/>
		<img :src="brand.logoDark" :alt="brand.name" :class="$style.dark"/>
	</template>
</span>
</template>

<script setup lang="ts">
import { brand } from '@@/js/branding.js';
import { instance } from '@/instance.js';
</script>

<style lang="scss" module>
.root {
	display: inline-block;
	max-width: 100%;
	min-width: 100px;
	vertical-align: middle;
	img { display: block; width: 100%; height: auto; object-fit: contain; }
}
.root .dark { display: none; }
:global(html[data-color-scheme='dark']) {
	.root .light { display: none; }
	.root .dark { display: block; }
}
</style>
