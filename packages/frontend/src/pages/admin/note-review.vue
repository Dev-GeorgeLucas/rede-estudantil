<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<article class="_panel _gaps" :class="$style.root" :aria-label="i18n.ts._noteReview.automatic">
	<header class="_gaps_s">
		<b><i class="ti ti-flag" aria-hidden="true"></i> {{ i18n.ts._noteReview.automatic }}</b>
		<time :datetime="review.createdAt">{{ new Date(review.createdAt).toLocaleString() }}</time>
		<div>{{ i18n.ts.state }}: {{ current.state === 'pending' ? i18n.ts.unresolved : i18n.ts.resolved }}</div>
	</header>
	<div>{{ i18n.ts._noteReview.matchedWords }}: <span v-for="word in review.matchedWords" :key="word" :class="$style.word">{{ word }}</span></div>
	<div v-if="deleted">{{ i18n.ts.deletedNote }}</div>
	<MkLoading v-else-if="loading"/>
	<div v-else-if="unavailable" role="status" class="_gaps_s">
		<span>{{ i18n.ts.unavailable }}</span>
		<MkButton :class="$style.action" @click="loadNote">{{ i18n.ts.retry }}</MkButton>
	</div>
	<template v-else-if="note">
		<MkA :to="`/notes/${note.id}`" class="_link">{{ i18n.ts.details }}</MkA>
		<MkNote :key="note.id" :note="note"/>
	</template>
	<div v-if="current.state === 'resolved'" ref="resolutionResult" class="_gaps_s" role="status" tabindex="-1">
		<b>{{ resolutionLabel(current.resolution) }}</b>
		<div>{{ i18n.ts.moderator }}: {{ current.resolvedById }}</div>
		<time v-if="current.resolvedAt" :datetime="current.resolvedAt">{{ new Date(current.resolvedAt).toLocaleString() }}</time>
	</div>
	<div v-else ref="resolutionControls" class="_gaps_s">
		<label :for="resolutionId">{{ i18n.ts._noteReview.outcome }}</label>
		<select :id="resolutionId" v-model="resolution" :disabled="saving" :class="$style.select">
			<option :value="null" disabled>{{ i18n.ts.pleaseSelect }}</option>
			<option v-for="outcome in outcomes" :key="outcome" :value="outcome">{{ i18n.ts._noteReview[outcome] }}</option>
		</select>
		<MkButton primary :class="$style.action" :disabled="saving || !resolution" @click="resolve">{{ i18n.ts._noteReview.close }}</MkButton>
	</div>
</article>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, shallowRef, useId, useTemplateRef, watch } from 'vue';
import type * as Misskey from 'misskey-js';
import MkNote from '@/components/MkNote.vue';
import MkButton from '@/components/MkButton.vue';
import { misskeyApi } from '@/utility/misskey-api.js';
import { deletedNoteIds, globalEvents, useGlobalEvent } from '@/events.js';
import { i18n } from '@/i18n.js';
import { isModerationAccessError } from '@/utility/pending-abuse-reports.js';
import * as os from '@/os.js';

type Review = Misskey.Endpoints['admin/note-reviews']['res'][number];
const props = defineProps<{ review: Review }>();
const emit = defineEmits<{ (event: 'resolved', id: string): void }>();
const current = shallowRef(props.review);
const resolutionControls = useTemplateRef('resolutionControls');
const resolutionResult = useTemplateRef('resolutionResult');
const note = shallowRef<Misskey.entities.Note | null>(null);
const deleted = ref(false);
const unavailable = ref(false);
const loading = ref(false);
const saving = ref(false);
let request: AbortController | undefined;
let generation = 0;
let active = true;
const resolutionId = useId();
const outcomes = ['falsePositive', 'reviewed', 'unavailable'] as const;
const resolution = ref<typeof outcomes[number] | null>(null);

function resolutionLabel(value: Review['resolution']) {
	return value ? i18n.ts._noteReview[value] : i18n.ts.resolved;
}

async function loadNote() {
	const revision = ++generation;
	request?.abort();
	request = new AbortController();
	note.value = null;
	unavailable.value = false;
	deleted.value = props.review.noteId === null || deletedNoteIds.has(props.review.noteId);
	if (deleted.value || !props.review.noteId) { loading.value = false; return; }
	loading.value = true;
	try {
		const fresh = await misskeyApi('notes/show', { noteId: props.review.noteId }, undefined, AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]));
		if (revision !== generation) return;
		// Hidden content is not a confirmed deletion; never use an earlier cached body.
		if (fresh.isHidden) unavailable.value = true;
		else note.value = fresh;
	} catch {
		if (revision === generation) unavailable.value = true;
	} finally {
		if (revision === generation) loading.value = false;
	}
}

watch(() => props.review, async review => {
	const restoreFocus = current.value.state === 'pending' && review.state === 'resolved' && resolutionControls.value?.contains(window.document.activeElement);
	current.value = review;
	if (restoreFocus) { await nextTick(); resolutionResult.value?.focus(); }
}, { immediate: true });
watch(() => props.review.noteId, () => { void loadNote(); }, { immediate: true });
useGlobalEvent('noteDeleted', id => {
	if (id !== props.review.noteId) return;
	generation++;
	request?.abort();
	note.value = null;
	deleted.value = true;
	loading.value = false;
});
onBeforeUnmount(() => { active = false; generation++; request?.abort(); });

async function resolve() {
	if (saving.value || !resolution.value || current.value.state !== 'pending') return;
	saving.value = true;
	try {
		const result = await misskeyApi('admin/resolve-note-review', { caseId: props.review.id, resolution: resolution.value });
		if (!active) return;
		current.value = result;
		globalEvents.emit('noteReviewResolved');
		if (result.alreadyResolved) await os.alert({ type: 'info', text: i18n.ts._noteReview.alreadyResolved });
		emit('resolved', result.id);
	} catch (error) {
		if (active && isModerationAccessError(error)) { globalEvents.emit('moderationAccessDenied'); return; }
		if (active) await os.alert({ type: 'error', text: i18n.ts.somethingHappened });
	} finally { saving.value = false; }
}
</script>

<style module lang="scss">
.action { min-height: 44px; }
.root { padding: 16px; min-width: 0; overflow-wrap: anywhere; }
.select {
	width: 100%; min-height: 44px; padding: 8px; box-sizing: border-box; font: inherit;
	color: var(--MI_THEME-fg); background: var(--MI_THEME-panel);
	border: 1px solid var(--MI_THEME-divider); border-radius: var(--MI-radius);
	&:focus-visible { outline: 2px solid var(--MI_THEME-focus); outline-offset: 2px; }
}
.word { display: inline-block; max-width: 100%; margin-inline-end: 8px; font-weight: bold; }
</style>
