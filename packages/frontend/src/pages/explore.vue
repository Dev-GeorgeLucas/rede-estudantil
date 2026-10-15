<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<div class="_spacer" style="--MI_SPACER-w: 800px;">
	<MkNotesTimeline :paginator="paginator" :withControl="false"/>
</div>
</template>

<script lang="ts" setup>
import { markRaw, onActivated, onDeactivated, onBeforeUnmount } from 'vue';
import MkNotesTimeline from '@/components/MkNotesTimeline.vue';
import { useStream } from '@/stream.js';
import { Paginator } from '@/utility/paginator.js';
import { i18n } from '@/i18n.js';

const paginator = markRaw(new Paginator('notes/discovery', { limit: 10 }));
let active = true;
let needsReload = false;

function onFollowingChange() {
	if (active) paginator.reload();
	else needsReload = true;
}

const connection = useStream().useChannel('main');
connection.on('follow', onFollowingChange);
connection.on('unfollow', onFollowingChange);
onBeforeUnmount(() => connection.dispose());
onDeactivated(() => { active = false; });
onActivated(() => {
	active = true;
	if (needsReload) {
		needsReload = false;
		paginator.reload();
	}
});

const headerActions = [{
	icon: 'ti ti-refresh',
	text: i18n.ts.reload,
	handler: () => paginator.reload(),
}];

defineExpose({ headerActions });
</script>
