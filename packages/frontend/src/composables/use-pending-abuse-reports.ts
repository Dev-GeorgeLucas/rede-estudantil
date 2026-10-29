/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { computed, effectScope, onScopeDispose, watch } from 'vue';
import { $i } from '@/i.js';
import { useStream } from '@/stream.js';
import { globalEvents } from '@/events.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { createPendingAbuseReports } from '@/utility/pending-abuse-reports.js';
import { i18n } from '@/i18n.js';

const monitor = createPendingAbuseReports({
	query: async (session, signal) => (await misskeyApi('admin/abuse-user-reports', { state: 'unresolved', limit: 1 }, session.token, AbortSignal.any([signal, AbortSignal.timeout(15_000)]))).length > 0,
	isVisible: () => window.document.visibilityState === 'visible',
	subscribe: invalidate => {
		const stream = useStream();
		const channel = stream.useChannel('admin');
		channel.on('newAbuseUserReport', invalidate);
		stream.on('_connected_', invalidate);
		globalEvents.on('abuseReportResolved', invalidate);
		return () => {
			channel.off('newAbuseUserReport', invalidate);
			channel.dispose();
			stream.off('_connected_', invalidate);
			globalEvents.off('abuseReportResolved', invalidate);
		};
	},
});

let consumers = 0;
let stop: (() => void) | undefined;
let endingSession = false;

export function usePendingAbuseReports() {
	if (consumers++ === 0) {
		const syncSession = () => monitor.setSession(endingSession ? null : $i);
		// Detached from the first consumer: a drawer can unmount while the shell remains.
		const scope = effectScope(true);
		scope.run(() => watch(() => [$i?.id, $i?.token, $i?.isAdmin, $i?.isModerator], (next, previous) => {
			if (previous && (next[0] !== previous[0] || next[1] !== previous[1])) endingSession = false;
			syncSession();
		}, { immediate: true, flush: 'sync' }));
		const endSession = () => {
			endingSession = true;
			monitor.dispose();
		};
		const resume = () => { syncSession(); monitor.invalidate(); };
		globalEvents.on('accountChanging', endSession);
		window.document.addEventListener('visibilitychange', monitor.visibilityChanged);
		window.addEventListener('focus', monitor.invalidate);
		window.addEventListener('pagehide', monitor.dispose);
		window.addEventListener('pageshow', resume);
		stop = () => {
			scope.stop();
			globalEvents.off('accountChanging', endSession);
			window.document.removeEventListener('visibilitychange', monitor.visibilityChanged);
			window.removeEventListener('focus', monitor.invalidate);
			window.removeEventListener('pagehide', monitor.dispose);
			window.removeEventListener('pageshow', resume);
			monitor.dispose();
		};
	}
	onScopeDispose(() => {
		if (--consumers === 0) { stop?.(); stop = undefined; }
	});

	const label = computed(() => {
		const parts = [i18n.ts.abuseReports];
		if (monitor.state.pending) parts.push(i18n.ts.thereIsUnresolvedAbuseReportWarning);
		if (monitor.state.error) parts.push(i18n.ts.abuseReportsUpdateFailed);
		else if (monitor.state.pending === null) parts.push(i18n.ts.loading);
		return parts.join(' — ');
	});
	return { state: monitor.state, label, refresh: monitor.invalidate };
}
