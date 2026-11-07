<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<XQueue v-if="state.authorized" :key="sessionVersion"/>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import XQueue from './note-reviews.queue.vue';
import { $i } from '@/i.js';
import { usePendingAbuseReports } from '@/composables/use-pending-abuse-reports.js';

const { state } = usePendingAbuseReports();
const sessionVersion = ref(0);
watch(() => [$i?.id, $i?.token], () => { sessionVersion.value++; }, { flush: 'sync' });
</script>
