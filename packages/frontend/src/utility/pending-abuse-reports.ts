/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { reactive, readonly } from 'vue';

export type ModerationSession = { id: string; token: string; isAdmin?: boolean; isModerator?: boolean };

// One controller per application, never persisted. Only retain existence, not report data.
export function createPendingAbuseReports(deps: {
	query: (session: ModerationSession, signal: AbortSignal) => Promise<boolean>;
	subscribe: (invalidate: () => void) => () => void;
	isVisible: () => boolean;
}) {
	const state = reactive({ authorized: false, pending: null as boolean | null, fetching: false, error: false });
	let session: ModerationSession | null = null;
	let generation = 0;
	let revision = 0;
	let request: AbortController | null = null;
	let unsubscribe: (() => void) | undefined;
	let timer: number | undefined;

	function clearTimer() {
		window.clearTimeout(timer);
		timer = undefined;
	}

	function schedule(delay: number) {
		clearTimer();
		if (session && deps.isVisible()) timer = window.setTimeout(() => { void refresh(); }, delay);
	}

	async function refresh() {
		clearTimer();
		if (!session || !deps.isVisible() || request) return;
		const currentGeneration = generation;
		const currentRevision = revision;
		const controller = new AbortController();
		request = controller;
		state.fetching = true;
		try {
			const pending = await deps.query(session, controller.signal);
			if (generation === currentGeneration && revision === currentRevision) {
				state.pending = pending;
				state.error = false;
			}
		} catch {
			if (generation === currentGeneration && revision === currentRevision) state.error = true;
		} finally {
			if (generation === currentGeneration) {
				request = null;
				state.fetching = false;
				// Coalesce events during a request into one follow-up; never overlap queries.
				schedule(revision === currentRevision ? 60_000 : 250);
			}
		}
	}

	function invalidate() {
		if (!session) return;
		revision++;
		if (!request) schedule(250);
	}

	function setSession(next: ModerationSession | null) {
		const authorized = next && (next.isAdmin === true || next.isModerator === true) ? next : null;
		if (session?.id === authorized?.id && session?.token === authorized?.token) return;
		generation++;
		clearTimer();
		request?.abort();
		request = null;
		unsubscribe?.();
		unsubscribe = undefined;
		session = authorized ? { ...authorized } : null;
		Object.assign(state, { authorized: session !== null, pending: null, fetching: false, error: false });
		if (session) {
			unsubscribe = deps.subscribe(invalidate);
			void refresh();
		}
	}

	function visibilityChanged() {
		clearTimer();
		if (deps.isVisible()) invalidate();
	}

	return { state: readonly(state), setSession, invalidate, visibilityChanged, dispose: () => setSession(null) };
}
