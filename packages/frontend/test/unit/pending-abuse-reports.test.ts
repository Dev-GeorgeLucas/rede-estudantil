/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { ModerationSession } from '@/utility/pending-abuse-reports.js';
import { createPendingAbuseReports } from '@/utility/pending-abuse-reports.js';

const moderator = { id: 'moderator', token: 'test-token', isModerator: true };

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
	return { promise, resolve, reject };
}

function setup() {
	const query = vi.fn<(session: ModerationSession, signal: AbortSignal) => Promise<boolean>>().mockResolvedValue(false);
	const queryRules = vi.fn().mockResolvedValue(false);
	const dispose = vi.fn();
	const subscribe = vi.fn(() => dispose);
	let visible = true;
	const monitor = createPendingAbuseReports({ query, queryRules, subscribe, isVisible: () => visible });
	return { monitor, query, queryRules, subscribe, dispose, hide: () => { visible = false; monitor.visibilityChanged(); }, show: () => { visible = true; monitor.visibilityChanged(); } };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('pending abuse reports controller', () => {
	test.each([null, { id: 'user', token: 'test-token' }])('does not query or subscribe for unauthorized session %j', session => {
		const { monitor, query, subscribe } = setup();
		monitor.setSession(session);
		monitor.invalidate();
		expect(query).not.toHaveBeenCalled();
		expect(subscribe).not.toHaveBeenCalled();
		expect(monitor.state.authorized).toBe(false);
	});

	test.each([moderator, { id: 'admin', token: 'test-token', isAdmin: true }])('loads existing pending reports for $id and retains only existence', async session => {
		const { monitor, query, subscribe } = setup();
		query.mockResolvedValue(true);
		monitor.setSession(session);
		expect(monitor.state).toMatchObject({ pending: null, fetching: true, error: false });
		await vi.advanceTimersByTimeAsync(0);
		expect(monitor.state.pending).toBe(true);
		expect(subscribe).toHaveBeenCalledOnce();
		monitor.setSession(session);
		expect(query).toHaveBeenCalledOnce();
		monitor.dispose();
	});

	test('coalesces creation, resolution and reconnection invalidations and clears the last report', async () => {
		const { monitor, query } = setup();
		monitor.setSession(moderator);
		await vi.advanceTimersByTimeAsync(0);
		expect(monitor.state.pending).toBe(false);
		query.mockResolvedValueOnce(true);
		for (let i = 0; i < 20; i++) monitor.invalidate();
		await vi.advanceTimersByTimeAsync(250);
		expect(query).toHaveBeenCalledTimes(2);
		expect(monitor.state.pending).toBe(true);
		monitor.invalidate();
		await vi.advanceTimersByTimeAsync(250);
		expect(monitor.state.pending).toBe(false);
		monitor.dispose();
	});

	test('initial failure remains unknown, retry recovers, later failure preserves pending reports', async () => {
		const { monitor, query } = setup();
		query.mockRejectedValueOnce(new Error('offline'));
		monitor.setSession(moderator);
		await vi.advanceTimersByTimeAsync(0);
		expect(monitor.state).toMatchObject({ pending: null, error: true, fetching: false });
		query.mockResolvedValueOnce(true);
		monitor.invalidate();
		await vi.advanceTimersByTimeAsync(250);
		expect(monitor.state).toMatchObject({ pending: true, error: false });
		query.mockRejectedValueOnce(new Error('offline'));
		monitor.invalidate();
		await vi.advanceTimersByTimeAsync(250);
		expect(monitor.state).toMatchObject({ pending: true, error: true });
		await vi.advanceTimersByTimeAsync(60_000);
		expect(monitor.state).toMatchObject({ pending: false, error: false });
		monitor.dispose();
	});

	test('only polls while visible and revalidates on returning', async () => {
		const { monitor, query, hide, show } = setup();
		monitor.setSession(moderator);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(query).toHaveBeenCalledTimes(2);
		hide();
		monitor.invalidate();
		await vi.advanceTimersByTimeAsync(180_000);
		expect(query).toHaveBeenCalledTimes(2);
		show();
		await vi.advanceTimersByTimeAsync(250);
		expect(query).toHaveBeenCalledTimes(3);
		monitor.dispose();
		expect(vi.getTimerCount()).toBe(0);
	});

	test('an event during a query invalidates its response and triggers one nonconcurrent follow-up', async () => {
		const { monitor, query } = setup();
		const old = deferred<boolean>();
		query.mockReturnValueOnce(old.promise).mockResolvedValue(true);
		monitor.setSession(moderator);
		for (let i = 0; i < 10; i++) monitor.invalidate();
		await vi.advanceTimersByTimeAsync(1000);
		expect(query).toHaveBeenCalledOnce();
		old.resolve(false);
		await vi.advanceTimersByTimeAsync(0);
		expect(monitor.state.pending).toBeNull();
		await vi.advanceTimersByTimeAsync(250);
		expect(monitor.state.pending).toBe(true);
		expect(query).toHaveBeenCalledTimes(2);
		monitor.dispose();
	});

	test.each(['logout', 'switch', 'revoke'] as const)('%s invalidates and aborts old requests, releases subscriptions and clears state', async action => {
		const { monitor, query, dispose } = setup();
		const old = deferred<boolean>();
		query.mockReturnValueOnce(old.promise);
		monitor.setSession(moderator);
		const signal = query.mock.calls[0][1];
		const next = action === 'switch' ? { ...moderator, id: 'other', token: 'other-token' } : action === 'revoke' ? { ...moderator, isModerator: false } : null;
		monitor.setSession(next);
		expect(signal.aborted).toBe(true);
		expect(dispose).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(0);
		old.resolve(true);
		await vi.advanceTimersByTimeAsync(0);
		expect(monitor.state.pending).toBe(action === 'switch' ? false : null);
		expect(monitor.state.authorized).toBe(action === 'switch');
		monitor.dispose();
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe('independent pending queues', () => {
	test.each([[true, false], [false, true], [true, true], [false, false]])('abuse %s, rules %s', async (human, rules) => {
		const { monitor, query, queryRules } = setup();
		query.mockResolvedValue(human); queryRules.mockResolvedValue(rules);
		monitor.setSession(moderator);
		await vi.advanceTimersByTimeAsync(0);
		expect(monitor.state).toMatchObject({ abusePending: human, rulePending: rules, pending: human || rules, error: false });
		query.mockResolvedValue(false); queryRules.mockResolvedValue(false);
		monitor.invalidate(); await vi.advanceTimersByTimeAsync(250);
		expect(monitor.state.pending).toBe(false);
		monitor.dispose();
	});

	test.each(['abuse', 'rule'] as const)('a failed %s query preserves its last result while the other queue updates', async failing => {
		const { monitor, query, queryRules } = setup();
		query.mockResolvedValue(true); queryRules.mockResolvedValue(true);
		monitor.setSession(moderator); await vi.advanceTimersByTimeAsync(0);
		const failed = failing === 'abuse' ? query : queryRules;
		const successful = failing === 'abuse' ? queryRules : query;
		failed.mockRejectedValue(new Error('offline')); successful.mockResolvedValue(false);
		monitor.invalidate(); await vi.advanceTimersByTimeAsync(250);
		expect(monitor.state.pending).toBe(true);
		expect(monitor.state[`${failing}Pending`]).toBe(true);
		expect(monitor.state.error).toBe(true);
		failed.mockResolvedValue(false);
		monitor.invalidate(); await vi.advanceTimersByTimeAsync(250);
		expect(monitor.state).toMatchObject({ pending: false, error: false });
		monitor.dispose();
	});

	test('an initial partial failure stays unknown; a confirmed pending queue still signals', async () => {
		const { monitor, query, queryRules } = setup();
		queryRules.mockRejectedValue(new Error('offline'));
		monitor.setSession(moderator); await vi.advanceTimersByTimeAsync(0);
		expect(monitor.state).toMatchObject({ pending: null, abusePending: false, rulePending: null, error: true });
		query.mockResolvedValue(true); monitor.invalidate(); await vi.advanceTimersByTimeAsync(250);
		expect(monitor.state).toMatchObject({ pending: true, error: true });
		monitor.dispose();
	});
});

test.each(['ROLE_PERMISSION_DENIED', 'AUTHENTICATION_FAILED', 'PERMISSION_DENIED'])('server %s removes administrative state even if the cached account still has its role', async code => {
	const { monitor, query, queryRules, dispose } = setup();
	query.mockResolvedValue(true); monitor.setSession(moderator); await vi.advanceTimersByTimeAsync(0);
	queryRules.mockRejectedValue({ code }); monitor.invalidate(); await vi.advanceTimersByTimeAsync(250);
	expect(monitor.state).toMatchObject({ authorized: false, pending: null, abusePending: null, rulePending: null });
	expect(dispose).toHaveBeenCalledOnce();
	const calls = query.mock.calls.length;
	monitor.setSession(moderator); monitor.visibilityChanged(); monitor.invalidate();
	await vi.advanceTimersByTimeAsync(120_000);
	expect(query).toHaveBeenCalledTimes(calls);
	monitor.setSession({ ...moderator, token: 'fresh-session' }); await vi.advanceTimersByTimeAsync(0);
	expect(query.mock.calls.length).toBeGreaterThan(calls);
	monitor.dispose();
});

test('repeated access denials keep the old session blocked across dispose/pageshow', async () => {
	const { monitor, query, subscribe } = setup();
	monitor.setSession(moderator); await vi.advanceTimersByTimeAsync(0);
	monitor.denySession(); monitor.denySession(); monitor.dispose();
	monitor.setSession(moderator); monitor.visibilityChanged();
	await vi.advanceTimersByTimeAsync(120_000);
	expect(monitor.state).toMatchObject({ authorized: false, pending: null });
	expect(query).toHaveBeenCalledOnce();
	expect(subscribe).toHaveBeenCalledOnce();
});
