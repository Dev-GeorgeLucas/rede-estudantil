<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_gaps">
	<MkInfo>{{ i18n.ts._noteReview.explanation }}</MkInfo>
	<label :for="filterId">{{ i18n.ts.state }}</label>
	<select :id="filterId" ref="filter" v-model="state" :class="$style.select">
		<option value="pending">{{ i18n.ts.unresolved }}</option>
		<option value="resolved">{{ i18n.ts.resolved }}</option>
	</select>
	<MkButton :class="$style.action" @click="reload">{{ newerAvailable ? i18n.ts._noteReview.newCases : i18n.ts.reload }}</MkButton>
	<MkInfo v-if="refreshError" warn>{{ i18n.ts._noteReview.updateFailed }}</MkInfo>
	<MkInfo v-if="closedInPending">{{ i18n.ts._noteReview.updatedCases }}</MkInfo>
	<MkPagination v-slot="{ items }" :paginator="paginator">
		<div class="_gaps">
			<XNoteReview v-for="review in items" :key="review.id" :review="review" @resolved="resolved"/>
		</div>
	</MkPagination>
</div>
</template>

<script setup lang="ts">
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, useId, useTemplateRef, watch } from 'vue';
import XNoteReview from './note-review.vue';
import MkInfo from '@/components/MkInfo.vue';
import MkButton from '@/components/MkButton.vue';
import MkPagination from '@/components/MkPagination.vue';
import { i18n } from '@/i18n.js';
import { Paginator } from '@/utility/paginator.js';
import { isModerationAccessError } from '@/utility/pending-abuse-reports.js';
import { globalEvents, useGlobalEvent } from '@/events.js';
import { misskeyApi } from '@/utility/misskey-api.js';

const state = ref<'pending' | 'resolved'>('pending');
const filterId = useId();
const filter = useTemplateRef('filter');
const newerAvailable = ref(false);
const refreshError = ref(false);
const paginator = markRaw(new Paginator('admin/note-reviews', {
	limit: 10, computedParams: computed(() => ({ state: state.value })),
}));
const closedInPending = computed(() => state.value === 'pending' && paginator.items.value.some(item => item.state === 'resolved'));
let debounce: number | undefined;
let interval: number | undefined;
let request: AbortController | undefined;
let generation = 0;
watch(state, () => { generation++; request?.abort(); request = undefined; newerAvailable.value = false; refreshError.value = false; });

async function refresh() {
	if (window.document.visibilityState !== 'visible' || request || paginator.fetching.value || paginator.fetchingOlder.value) return;
	if (paginator.items.value.length === 0) { await paginator.reload(); return; }
	const revision = generation;
	const controller = new AbortController();
	request = controller;
	const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
	const ids = paginator.items.value.map(item => item.id);
	try {
		// Revalidate loaded IDs in bounded batches without resetting cursors, cards or focus.
		for (let offset = 0; offset < ids.length; offset += 100) {
			const fresh = await misskeyApi('admin/note-reviews', { state: 'all', limit: 100, caseIds: ids.slice(offset, offset + 100) }, undefined, signal);
			if (revision !== generation) return;
			for (const item of fresh) paginator.updateItem(item.id, previous => JSON.stringify(previous) === JSON.stringify(item) ? previous : item);
		}
		const latest = await misskeyApi('admin/note-reviews', { state: state.value, limit: 1 }, undefined, signal);
		if (revision !== generation) return;
		newerAvailable.value = latest.some(item => !ids.includes(item.id) && item.id > ids[0]);
		refreshError.value = false;
	} catch (error) {
		if (revision === generation && isModerationAccessError(error)) { globalEvents.emit('moderationAccessDenied'); return; }
		if (revision === generation) refreshError.value = true;
	} finally {
		if (revision === generation) request = undefined;
	}
}

function reload() {
	generation++;
	request?.abort(); request = undefined;
	newerAvailable.value = false; refreshError.value = false;
	void paginator.reload();
}

function invalidate() {
	window.clearTimeout(debounce);
	debounce = window.setTimeout(() => { void refresh(); }, 250);
}

async function resolved(id: string) {
	if (state.value !== 'pending') return;
	const revision = generation;
	await nextTick();
	if (revision !== generation) return;
	filter.value?.focus();
	if (paginator.items.value.length === 1 && paginator.canFetchOlder.value) {
		// Keep the last item as the cursor until the next page has arrived.
		await paginator.fetchOlder();
		if (revision !== generation) return;
		if (paginator.items.value.length === 1 && paginator.canFetchOlder.value) {
			refreshError.value = true;
			return;
		}
	}
	paginator.removeItem(id);
}

useGlobalEvent('noteReviewsChanged', invalidate);
onMounted(() => {
	interval = window.setInterval(() => { void refresh(); }, 60_000);
	window.addEventListener('focus', invalidate);
	window.document.addEventListener('visibilitychange', invalidate);
});
onBeforeUnmount(() => {
	generation++; request?.abort();
	window.clearTimeout(debounce);
	window.clearInterval(interval);
	window.removeEventListener('focus', invalidate);
	window.document.removeEventListener('visibilitychange', invalidate);
});
</script>

<style module lang="scss">
.action { min-height: 44px; }
.select {
	width: 100%; min-height: 44px; padding: 8px; box-sizing: border-box; font: inherit;
	color: var(--MI_THEME-fg); background: var(--MI_THEME-panel);
	border: 1px solid var(--MI_THEME-divider); border-radius: var(--MI-radius);
	&:focus-visible { outline: 2px solid var(--MI_THEME-focus); outline-offset: 2px; }
}
</style>
