<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div v-if="context && context.state.value.status !== 'available'" :class="$style.deleted" role="status">
	<MkLoading v-if="context.state.value.status === 'loading'" :inline="true"/>
	<template v-else-if="context.state.value.status === 'deleted'">{{ i18n.ts.originalNoteDeleted }}</template>
	<template v-else-if="context.state.value.status === 'unavailable'">{{ i18n.ts.originalNoteUnavailable }}</template>
	<template v-else>
		{{ i18n.ts.somethingHappened }}
		<MkButton :class="$style.retry" small @click="context.refresh()">{{ i18n.ts.retry }}</MkButton>
	</template>
</div>
<div v-else-if="note == null" :class="$style.deleted">
	{{ i18n.ts.unavailable }}
</div>
<div v-else-if="!muted" :class="[$style.root, { [$style.children]: depth > 1 }]">
	<div :class="$style.main">
		<div v-if="note.channel" :class="$style.colorBar" :style="{ background: note.channel.color }"></div>
		<MkAvatar :class="$style.avatar" :user="note.user" link preview/>
		<div :class="$style.body">
			<MkNoteHeader :class="$style.header" :note="note" :mini="true"/>
			<div>
				<p v-if="note.cw != null" :class="$style.cw">
					<Mfm v-if="note.cw != ''" style="margin-right: 8px;" :text="note.cw" :author="note.user" :nyaize="'respect'"/>
					<MkCwButton v-model="showContent" :text="note.text" :files="note.files" :poll="note.poll"/>
				</p>
				<div v-show="note.cw == null || showContent">
					<MkSubNoteContent :class="$style.text" :note="note"/>
				</div>
			</div>
		</div>
	</div>
	<template v-if="depth < 5">
		<MkNoteSub v-for="reply in replies" :key="reply.id" :note="reply" :class="$style.reply" :detail="true" :depth="depth + 1"/>
	</template>
	<div v-else :class="$style.more">
		<MkA class="_link" :to="notePage(note)">{{ i18n.ts.continueThread }} <i class="ti ti-chevron-double-right"></i></MkA>
	</div>
</div>
<div v-else :class="$style.muted" @click="muted = false">
	<I18n :src="i18n.ts.userSaysSomething" tag="small">
		<template #name>
			<MkA v-user-preview="note.userId" :to="userPage(note.user)">
				<MkUserName :user="note.user"/>
			</MkA>
		</template>
	</I18n>
</div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import * as Misskey from 'misskey-js';
import MkNoteHeader from '@/components/MkNoteHeader.vue';
import MkSubNoteContent from '@/components/MkSubNoteContent.vue';
import MkCwButton from '@/components/MkCwButton.vue';
import { notePage } from '@/filters/note.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { i18n } from '@/i18n.js';
import { $i } from '@/i.js';
import { userPage } from '@/filters/user.js';
import { checkWordMute } from '@/utility/check-word-mute.js';
import { useNoteContext } from '@/composables/use-note-context.js';
import MkButton from '@/components/MkButton.vue';

const props = withDefaults(defineProps<{
	note: Misskey.entities.Note | null;
	detail?: boolean;
	// Verify conversation context independently of the embedded/cached snapshot.
	contextId?: string;

	// how many notes are in between this one and the note being viewed in detail
	depth?: number;
}>(), {
	depth: 1,
});

const emit = defineEmits<{
	(ev: 'contextUpdated', note: Misskey.entities.Note | null): void;
}>();
const context = props.contextId ? useNoteContext(() => props.contextId!) : null;
const note = computed(() => context ? context.state.value.note : props.note);
if (context) watch(context.state, state => emit('contextUpdated', state.note), { immediate: true, flush: 'sync' });

const muted = ref(props.note && $i ? checkWordMute(props.note, $i, $i.mutedWords) : false);
watch(note, value => { muted.value = value && $i ? checkWordMute(value, $i, $i.mutedWords) : false; });

const showContent = ref(false);
const replies = ref<Misskey.entities.Note[]>([]);

if (props.detail && props.note) {
	misskeyApi('notes/children', {
		noteId: props.note.id,
		limit: 5,
	}).then(res => {
		replies.value = res;
	});
}
</script>

<style lang="scss" module>
.root {
	padding: 16px 32px;
	font-size: 0.9em;
	position: relative;

	&.children {
		padding: 10px 0 0 16px;
		font-size: 1em;
	}
}

.main {
	display: flex;
}

.colorBar {
	position: absolute;
	top: 8px;
	left: 8px;
	width: 5px;
	height: calc(100% - 8px);
	border-radius: 999px;
	pointer-events: none;
}

.avatar {
	flex-shrink: 0;
	display: block;
	margin: 0 8px 0 0;
	width: 38px;
	height: 38px;
	border-radius: 8px;
}

.body {
	flex: 1;
	min-width: 0;
}

.header {
	margin-bottom: 2px;
}

.cw {
	cursor: default;
	display: block;
	margin: 0;
	padding: 0;
	overflow-wrap: break-word;
}

.text {
	margin: 0;
	padding: 0;
}

.reply, .more {
	border-left: solid 0.5px var(--MI_THEME-divider);
	margin-top: 10px;
}

.more {
	padding: 10px 0 0 16px;
}

@container (max-width: 450px) {
	.root {
		padding: 14px 16px;

		&.children {
			padding: 10px 0 0 8px;
		}
	}
}

.muted {
	text-align: center;
	padding: 8px !important;
	border: 1px solid var(--MI_THEME-divider);
	margin: 8px 8px 0 8px;
	border-radius: 8px;
}

.deleted {
	text-align: center;
	padding: 8px !important;
	margin: 8px 8px 0 8px;
	--color: light-dark(rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.15));
	background-size: auto auto;
	background-image: repeating-linear-gradient(135deg, transparent, transparent 10px, var(--color) 4px, var(--color) 14px);
	border-radius: 8px;
}

.retry {
	margin: 8px auto 0;
}
</style>
