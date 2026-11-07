/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { reactive, readonly } from 'vue';

export type ModerationSession = { id: string; token: string; isAdmin?: boolean; isModerator?: boolean };

export function isModerationAccessError(error: unknown): boolean {
	return typeof error === 'object' && error !== null && 'code' in error &&
		['ROLE_PERMISSION_DENIED', 'PERMISSION_DENIED', 'ACCESS_DENIED', 'AUTHENTICATION_FAILED', 'CREDENTIAL_REQUIRED'].includes(String(error.code));
}

// One controller per application, never persisted. Only retain existence, not report data.
export function createPendingAbuseReports(deps: {
	query: (session: ModerationSession, signal: AbortSignal) => Promise<boolean>;
	queryRules: (session: ModerationSession, signal: AbortSignal) => Promise<boolean>;
	subscribe: (invalidate: () => void) => () => void;
	isVisible: () => boolean;
}) {
	const state = reactive({
		authorized: false, fetching: false,
		abusePending: null as boolean | null, rulePending: null as boolean | null,
		abuseError: false, ruleError: false,
		get pending(): boolean | null {
			if (this.abusePending === true || this.rulePending === true) return true;
			return this.abusePending === false && this.rulePending === false ? false : null;
		},
		get error() { return this.abuseError || this.ruleError; },
	});
	let session: ModerationSession | null = null;
	let deniedSession: ModerationSession | null = null;
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
			const results = await Promise.allSettled([deps.query(session, controller.signal), deps.queryRules(session, controller.signal)]);
			if (generation === currentGeneration && revision === currentRevision) {
				if (results.some(result => result.status === 'rejected' && isModerationAccessError(result.reason))) { denySession(); return; }
				for (const [index, queue] of (['abuse', 'rule'] as const).entries()) {
					const result = results[index];
					state[`${queue}Error`] = result.status === 'rejected';
					if (result.status === 'fulfilled') state[`${queue}Pending`] = result.value;
				}
			}
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
		if (deniedSession && next && ['id', 'token', 'isAdmin', 'isModerator'].some(key => next[key as keyof ModerationSession] !== deniedSession?.[key as keyof ModerationSession])) deniedSession = null;
		const authorized = next && !deniedSession && (next.isAdmin === true || next.isModerator === true) ? next : null;
		if (session?.id === authorized?.id && session?.token === authorized?.token) return;
		generation++;
		clearTimer();
		request?.abort();
		request = null;
		unsubscribe?.();
		unsubscribe = undefined;
		session = authorized ? { ...authorized } : null;
		Object.assign(state, { authorized: session !== null, abusePending: null, rulePending: null, fetching: false, abuseError: false, ruleError: false });
		if (session) {
			unsubscribe = deps.subscribe(invalidate);
			void refresh();
		}
	}

	function denySession() {
		if (!session) return;
		const previous = session;
		setSession(null);
		deniedSession = previous;
	}

	function visibilityChanged() {
		clearTimer();
		if (deps.isVisible()) invalidate();
	}

	return { state: readonly(state), setSession, denySession, invalidate, visibilityChanged, dispose: () => setSession(null) };
}
