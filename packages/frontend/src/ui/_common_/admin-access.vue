<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="state.authorized" :class="[$style.root, { [$style.horizontal]: horizontal }]">
	<slot></slot>
	<div v-if="state.pending || state.pending === null || state.error" :class="[$style.status, { [$style.compact]: compact }]">
		<MkA v-tooltip="label" to="/admin/abuses" :class="$style.link" :aria-label="label">
			<i :class="state.pending ? 'ti ti-alert-circle' : state.error ? 'ti ti-cloud-off' : 'ti ti-hourglass'" aria-hidden="true"></i>
			<span v-if="!compact">{{ i18n.ts.abuseReports }}</span>
			<i v-if="state.pending && state.error" class="ti ti-cloud-off" aria-hidden="true"></i>
		</MkA>
		<button v-if="state.error" v-tooltip="i18n.ts.retry" class="_button" :class="$style.retry" :aria-label="`${i18n.ts.abuseReports}: ${i18n.ts.retry}`" :disabled="state.fetching" @click="refresh">
			<i class="ti ti-refresh" aria-hidden="true"></i>
		</button>
	</div>
</div>
</template>

<script setup lang="ts">
import { usePendingAbuseReports } from '@/composables/use-pending-abuse-reports.js';
import { i18n } from '@/i18n.js';

defineProps<{ compact?: boolean; horizontal?: boolean }>();
const { state, label, refresh } = usePendingAbuseReports();
</script>

<style lang="scss" module>
.root { min-width: 0; }
.horizontal { display: inline-flex; align-items: center; vertical-align: middle; }
.status { display: flex; align-items: center; padding: 0 12px; color: var(--MI_THEME-navFg); font-size: 0.85em; }
.compact { justify-content: center; flex-wrap: wrap; padding: 0; }
.link, .retry {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	min-width: 44px;
	min-height: 44px;
	border-radius: var(--MI-radius);
	&:focus-visible { outline: 2px solid var(--MI_THEME-focus); outline-offset: -2px; }
}
.link { padding: 0 8px; box-sizing: border-box; }
</style>
