<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader v-model:tab="tab" :tabs="headerTabs" :actions="headerActions" :swipable="true">
	<div v-if="tab === 'notes'">
		<div class="_spacer" style="--MI_SPACER-w: 800px;">
			<MkNotesTimeline :paginator="paginator" :withControl="false"/>
		</div>
	</div>
	<div v-else-if="tab === 'users'">
		<XUsers/>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, watch, ref, markRaw, onBeforeUnmount } from 'vue';
import MkNotesTimeline from '@/components/MkNotesTimeline.vue';
import { useStream } from '@/stream.js';
import { Paginator } from '@/utility/paginator.js';
import XUsers from './explore.users.vue';
import { definePage } from '@/page.js';
import { i18n } from '@/i18n.js';

const props = withDefaults(defineProps<{
	initialTab?: string;
}>(), {
	initialTab: 'notes',
});

const tab = ref('notes');
// Old #featured/#roles links and unknown tabs safely open discovery.
watch(() => props.initialTab, value => {
	tab.value = value === 'users' ? 'users' : 'notes';
}, { immediate: true });

const paginator = markRaw(new Paginator('notes/discovery', { limit: 10 }));

const connection = useStream().useChannel('main');
connection.on('follow', () => paginator.reload());
connection.on('unfollow', () => paginator.reload());
onBeforeUnmount(() => connection.dispose());

const headerActions = computed(() => tab.value === 'notes' ? [{
	icon: 'ti ti-refresh',
	text: i18n.ts.reload,
	handler: () => paginator.reload(),
}] : []);

const headerTabs = computed(() => [{
	key: 'notes',
	icon: 'ti ti-notes',
	title: i18n.ts.notes,
}, {
	key: 'users',
	icon: 'ti ti-users',
	title: i18n.ts.users,
}]);

definePage(() => ({
	title: i18n.ts.explore,
	icon: 'ti ti-hash',
}));
</script>
