<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

<template>
<PageWithHeader ref="page" :tab="tab" :tabs="headerTabs" :actions="headerActions" :displayMyAvatar="!!$i" :overridePageMetadata="metadata" :preserveTabScroll="true" :retainScroll="false" :swipable="false" @update:tab="selectTab">
	<div :id="`${id}-${tab}`" role="tabpanel" :aria-labelledby="`${id}-${tab}-tab`" tabindex="0">
		<KeepAlive>
			<component :is="contents[tab]" ref="content"/>
		</KeepAlive>
	</div>
</PageWithHeader>
</template>

<script lang="ts" setup>
import { computed, nextTick, onActivated, onDeactivated, ref, useId, useTemplateRef, watch } from 'vue';
import type { PageHeaderItem } from '@/types/page-header.js';
import { $i } from '@/i.js';
import { i18n } from '@/i18n.js';
import { definePage } from '@/page.js';
import { useRouter } from '@/router.js';
import { page as lazyPage } from '@/router.definition.js';

type FeedTab = 'following' | 'explore' | 'users';

const router = useRouter();
const id = useId();
const page = useTemplateRef<{ $el: HTMLElement }>('page');
const content = useTemplateRef<{ headerActions?: PageHeaderItem[] }>('content');
const headerActions = computed(() => content.value?.headerActions ?? []);
const tab = ref<FeedTab>($i ? 'following' : 'users');
const contents = {
	following: lazyPage(() => import('./timeline.following.vue')),
	explore: lazyPage(() => import('./explore.vue')),
	users: lazyPage(() => import('./explore.users.vue')),
};
const headerTabs = computed(() => [
	...($i ? [{ key: 'following', title: i18n.ts.following, icon: 'ti ti-home' }, { key: 'explore', title: i18n.ts.explore, icon: 'ti ti-hash' }] : []),
	{ key: 'users', title: i18n.ts.users, icon: 'ti ti-users' },
].map(item => ({ ...item, panelId: `${id}-${item.key}` })));

// Keep a scroll position per tab, including an anchor for notes using render skipping.
const positions = new Map<FeedTab, { top: number; anchor?: string; offset?: number }>();
let active = true;

function savePosition(key: FeedTab) {
	const el = page.value?.$el;
	if (!el || !active) return;
	const rect = el.getBoundingClientRect();
	const anchor = el.scrollTop >= 100 ? Array.from(el.querySelectorAll<HTMLElement>('[data-scroll-anchor]'))
		.reverse().find(item => item.getBoundingClientRect().top <= rect.top + rect.height / 2) : undefined;
	positions.set(key, { top: el.scrollTop, anchor: anchor?.dataset.scrollAnchor, offset: anchor ? anchor.getBoundingClientRect().top - rect.top : undefined });
}

async function restorePosition(key: FeedTab) {
	await nextTick();
	const el = page.value?.$el;
	if (!el || !active || tab.value !== key) return;
	const saved = positions.get(key);
	el.scrollTop = saved?.top ?? 0;
	if (saved?.anchor) {
		const target = el.querySelector<HTMLElement>(`[data-scroll-anchor="${CSS.escape(saved.anchor)}"]`);
		if (target) el.scrollTop += target.getBoundingClientRect().top - el.getBoundingClientRect().top - (saved.offset ?? 0);
	}
}

watch(tab, (next, previous) => {
	savePosition(previous);
	restorePosition(next);
});
// Capture before RouterView detaches the page; detached virtualized notes have no useful geometry.
router.useListener('change', ({ resolved }) => {
	if (resolved.route.path !== '/feed') savePosition(tab.value);
});
onDeactivated(() => { active = false; });
onActivated(() => {
	active = true;
	restorePosition(tab.value);
});

watch(router.currentRef, current => {
	// Cached pages must ignore navigation elsewhere. The hash is deliberately not a route prop.
	if (current.route.path !== '/feed') return;
	const hash = current._parsedRoute.hash;
	tab.value = !$i ? 'users' : hash === 'users' || hash === 'explore' ? hash : 'following';
}, { immediate: true });

function selectTab(key: string | undefined) {
	if (key == null || key === tab.value || !headerTabs.value.some(item => item.key === key)) return;
	router.pushByPath(`/feed#${key}`);
}

const metadata = { title: i18n.ts.timeline, icon: 'ti ti-home' };
definePage(() => metadata);
</script>
