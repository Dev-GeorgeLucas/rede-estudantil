<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader :tab="tab" :actions="headerActions" :tabs="headerTabs" :swipable="false" @update:tab="selectTab">
	<div class="_spacer" style="--MI_SPACER-w: 900px;">
		<div v-if="tab === 'human'" :id="`${id}-human`" role="tabpanel" :aria-labelledby="`${id}-human-tab`" :class="$style.root" class="_gaps">
			<div :class="$style.subMenus" class="_gaps">
				<MkButton type="routerLink" to="/admin/abuse-report-notification-recipient" primary>{{ i18n.ts.notificationSetting }}</MkButton>
			</div>

			<MkTip k="abuses">
				{{ i18n.ts._abuseUserReport.resolveTutorial }}
			</MkTip>

			<div :class="$style.inputs" class="_gaps">
				<MkSelect v-model="state" :items="stateDef" style="margin: 0; flex: 1;">
					<template #label>{{ i18n.ts.state }}</template>
				</MkSelect>
				<MkSelect v-model="targetUserOrigin" :items="targetUserOriginDef" style="margin: 0; flex: 1;">
					<template #label>{{ i18n.ts.reporteeOrigin }}</template>
				</MkSelect>
				<MkSelect v-model="reporterOrigin" :items="reporterOriginDef" style="margin: 0; flex: 1;">
					<template #label>{{ i18n.ts.reporterOrigin }}</template>
				</MkSelect>
			</div>

			<!-- TODO
			<div class="inputs" style="display: flex; padding-top: 1.2em;">
				<MkInput v-model="searchUsername" style="margin: 0; flex: 1;" type="text" :spellcheck="false">
					<span>{{ i18n.ts.username }}</span>
				</MkInput>
				<MkInput v-model="searchHost" style="margin: 0; flex: 1;" type="text" :spellcheck="false" :disabled="paginator.computedParams.value.origin === 'local'">
					<span>{{ i18n.ts.host }}</span>
				</MkInput>
			</div>
			-->

			<MkPagination v-slot="{items}" :paginator="paginator">
				<div class="_gaps">
					<XAbuseReport v-for="report in items" :key="report.id" :report="report" @resolved="resolved"/>
				</div>
			</MkPagination>
		</div>
		<div v-else :id="`${id}-rules`" role="tabpanel" :aria-labelledby="`${id}-rules-tab`"><XNoteReviews/></div>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, ref, markRaw, useId, watch } from 'vue';
import XNoteReviews from './note-reviews.vue';
import { useRouter } from '@/router.js';
import MkSelect from '@/components/MkSelect.vue';
import MkPagination from '@/components/MkPagination.vue';
import XAbuseReport from '@/components/MkAbuseReport.vue';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { useMkSelect } from '@/composables/use-mkselect.js';
import MkButton from '@/components/MkButton.vue';
import { store } from '@/store.js';
import { Paginator } from '@/utility/paginator.js';

const {
	model: state,
	def: stateDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts.all, value: 'all' },
		{ label: i18n.ts.unresolved, value: 'unresolved' },
		{ label: i18n.ts.resolved, value: 'resolved' },
	],
	initialValue: 'unresolved',
});
const {
	model: reporterOrigin,
	def: reporterOriginDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts.all, value: 'combined' },
		{ label: i18n.ts.local, value: 'local' },
		{ label: i18n.ts.remote, value: 'remote' },
	],
	initialValue: 'combined',
});
const {
	model: targetUserOrigin,
	def: targetUserOriginDef,
} = useMkSelect({
	items: [
		{ label: i18n.ts.all, value: 'combined' },
		{ label: i18n.ts.local, value: 'local' },
		{ label: i18n.ts.remote, value: 'remote' },
	],
	initialValue: 'combined',
});
const searchUsername = ref('');
const searchHost = ref('');

const paginator = markRaw(new Paginator('admin/abuse-user-reports', {
	limit: 10,
	computedParams: computed(() => ({
		state: state.value,
		reporterOrigin: reporterOrigin.value,
		targetUserOrigin: targetUserOrigin.value,
	})),
}));

function resolved(reportId: string) {
	paginator.removeItem(reportId);
}

const headerActions = computed(() => []);

const router = useRouter();
const id = useId();
const tab = ref('human');
watch(router.currentRef, current => { tab.value = current._parsedRoute.hash === 'rules' ? 'rules' : 'human'; }, { immediate: true });

function selectTab(key: string | undefined) {
	if (key && key !== tab.value) router.pushByPath(key === 'rules' ? '/admin/abuses#rules' : '/admin/abuses');
}

const headerTabs = computed(() => [
	{ key: 'human', title: i18n.ts.abuseReports, icon: 'ti ti-exclamation-circle', panelId: `${id}-human` },
	{ key: 'rules', title: i18n.ts._noteReview.title, icon: 'ti ti-flag', panelId: `${id}-rules` },
]);

definePage(() => ({
	title: i18n.ts.abuseReports,
	icon: 'ti ti-exclamation-circle',
}));
</script>

<style module lang="scss">
.root {
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: stretch;
}

.subMenus {
	display: flex;
	flex-direction: row;
	justify-content: flex-end;
	align-items: center;
}

.inputs {
	display: flex;
	flex-direction: row;
	flex-wrap: wrap;
	justify-content: space-between;
	align-items: center;
}
</style>
