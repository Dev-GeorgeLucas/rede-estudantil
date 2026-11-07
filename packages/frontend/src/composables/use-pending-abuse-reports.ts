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
	queryRules: async (session, signal) => (await misskeyApi('admin/note-reviews', { state: 'pending', limit: 1 }, session.token, AbortSignal.any([signal, AbortSignal.timeout(15_000)]))).length > 0,
	isVisible: () => window.document.visibilityState === 'visible',
	subscribe: invalidate => {
		const stream = useStream();
		const channel = stream.useChannel('admin');
		channel.on('newAbuseUserReport', invalidate);
		const rulesChanged = () => { invalidate(); globalEvents.emit('noteReviewsChanged'); };
		channel.on('noteReviewCreated', rulesChanged);
		channel.on('noteReviewResolved', rulesChanged);
		stream.on('_connected_', invalidate);
		globalEvents.on('abuseReportResolved', invalidate);
		globalEvents.on('noteReviewResolved', invalidate);
		return () => {
			channel.off('newAbuseUserReport', invalidate);
			channel.off('noteReviewCreated', rulesChanged);
			channel.off('noteReviewResolved', rulesChanged);
			channel.dispose();
			stream.off('_connected_', invalidate);
			globalEvents.off('abuseReportResolved', invalidate);
			globalEvents.off('noteReviewResolved', invalidate);
		};
	},
});

let consumers = 0;
let stop: (() => void) | undefined;
let endingSession: { id: string; token: string } | null = null;

export function usePendingAbuseReports() {
	if (consumers++ === 0) {
		const syncSession = () => {
			if (endingSession && (endingSession.id !== $i?.id || endingSession.token !== $i?.token)) endingSession = null;
			monitor.setSession(endingSession ? null : $i);
		};
		// Detached from the first consumer: a drawer can unmount while the shell remains.
		const scope = effectScope(true);
		scope.run(() => watch(() => [$i?.id, $i?.token, $i?.isAdmin, $i?.isModerator], () => {
			syncSession();
		}, { immediate: true, flush: 'sync' }));
		const endSession = () => {
			endingSession = $i ? { id: $i.id, token: $i.token } : null;
			monitor.dispose();
		};
		const resume = () => { syncSession(); monitor.invalidate(); };
		globalEvents.on('accountChanging', endSession);
		globalEvents.on('moderationAccessDenied', monitor.denySession);
		window.document.addEventListener('visibilitychange', monitor.visibilityChanged);
		window.addEventListener('focus', monitor.invalidate);
		window.addEventListener('pagehide', monitor.dispose);
		window.addEventListener('pageshow', resume);
		stop = () => {
			scope.stop();
			globalEvents.off('accountChanging', endSession);
			globalEvents.off('moderationAccessDenied', monitor.denySession);
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

	function queueLabel(title: string, pending: boolean | null, error: boolean) {
		const parts = [title];
		if (pending) parts.push(title === i18n.ts.abuseReports ? i18n.ts.thereIsUnresolvedAbuseReportWarning : i18n.ts._noteReview.pendingWarning);
		if (error) parts.push(title === i18n.ts.abuseReports ? i18n.ts.abuseReportsUpdateFailed : i18n.ts._noteReview.updateFailed);
		else if (pending === null) parts.push(i18n.ts.loading);
		return parts.join(' — ');
	}

	const abuseLabel = computed(() => queueLabel(i18n.ts.abuseReports, monitor.state.abusePending, monitor.state.abuseError));
	const ruleLabel = computed(() => queueLabel(i18n.ts._noteReview.title, monitor.state.rulePending, monitor.state.ruleError));
	const label = computed(() => [abuseLabel.value, ruleLabel.value].join(' — '));
	return { state: monitor.state, label, abuseLabel, ruleLabel, refresh: monitor.invalidate };
}
