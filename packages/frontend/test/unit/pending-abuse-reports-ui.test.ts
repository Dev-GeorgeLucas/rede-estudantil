/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/vue';
import { defineComponent, h, nextTick, reactive, ref } from 'vue';
import { EventEmitter } from 'eventemitter3';
import AdminAccess from '@/ui/_common_/admin-access.vue';
import MobileFooter from '@/ui/_common_/mobile-footer-menu.vue';
import { usePendingAbuseReports } from '@/composables/use-pending-abuse-reports.js';
import { globalEvents } from '@/events.js';
import { i18n } from '@/i18n.js';

const session = vi.hoisted(() => ({ user: null as null | { id: string; token: string; isModerator?: boolean; isAdmin?: boolean } }));
const mocks = vi.hoisted(() => ({ api: vi.fn(), useStream: vi.fn() }));
vi.mock('@/i.js', () => ({ get $i() { return session.user; } }));
vi.mock('@/stream.js', () => ({ useStream: mocks.useStream }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/navbar.js', () => ({ navbarItemDef: {} }));
vi.mock('@/router.js', async () => ({ mainRouter: { currentRoute: (await import('vue')).ref({ path: '/feed' }), push: vi.fn() } }));
vi.mock('@/os.js', () => ({ post: vi.fn() }));

const global = {
	components: { MkA: { props: ['to'], template: '<a :href="to"><slot/></a>' } },
	directives: { tooltip: {} },
};
const Probe = defineComponent({ setup() { usePendingAbuseReports(); return () => null; } });
let stream: EventEmitter;
let channel: EventEmitter;
let dispose: ReturnType<typeof vi.fn>;
let useChannel: ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.useFakeTimers();
	Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
	stream = new EventEmitter();
	channel = new EventEmitter();
	dispose = vi.fn();
	useChannel = vi.fn(() => Object.assign(channel, { dispose }));
	mocks.useStream.mockReturnValue(Object.assign(stream, { useChannel }));
	mocks.api.mockResolvedValue([]);
	session.user = reactive({ id: 'moderator', token: 'fake-token', isModerator: true });
});
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.clearAllMocks(); });

describe('shared moderation indicator', () => {
	test.each(['visitor', 'user', 'moderator', 'admin'])('%s only starts authorized monitoring', async role => {
		session.user = role === 'visitor' ? null : { id: role, token: 'fake-token', isModerator: role === 'moderator', isAdmin: role === 'admin' };
		mocks.api.mockResolvedValue([{ id: 'private-report', comment: 'must not appear', reporterId: 'private-reporter' }]);
		const view = render(AdminAccess, { global });
		await vi.advanceTimersByTimeAsync(0);
		const authorized = role === 'moderator' || role === 'admin';
		expect(mocks.api).toHaveBeenCalledTimes(authorized ? 1 : 0);
		expect(useChannel).toHaveBeenCalledTimes(authorized ? 1 : 0);
		expect(view.queryByRole('link', { name: new RegExp(i18n.ts.thereIsUnresolvedAbuseReportWarning) }) !== null).toBe(authorized);
		expect(view.container.textContent).not.toContain('private');
		if (authorized) expect(mocks.api).toHaveBeenCalledWith('admin/abuse-user-reports', { state: 'unresolved', limit: 1 }, 'fake-token', expect.any(AbortSignal));
	});

	test('multiple consumers share one subscription even when the first unmounts', async () => {
		const visible = ref(true);
		render(defineComponent({ setup: () => () => [visible.value ? h(Probe) : null, h(Probe)] }));
		await vi.advanceTimersByTimeAsync(0);
		expect(useChannel).toHaveBeenCalledOnce();
		expect(mocks.api).toHaveBeenCalledOnce();
		visible.value = false;
		await nextTick();
		expect(dispose).not.toHaveBeenCalled();
		channel.emit('newAbuseUserReport', { comment: 'ignored' });
		stream.emit('_connected_');
		globalEvents.emit('abuseReportResolved');
		window.dispatchEvent(new Event('focus'));
		await vi.advanceTimersByTimeAsync(250);
		expect(mocks.api).toHaveBeenCalledTimes(2);
		cleanup();
		expect(dispose).toHaveBeenCalledOnce();
		expect(stream.listenerCount('_connected_')).toBe(0);
		expect(channel.listenerCount('newAbuseUserReport')).toBe(0);
		expect(globalEvents.listenerCount('abuseReportResolved')).toBe(0);
		window.dispatchEvent(new Event('focus'));
		await vi.advanceTimersByTimeAsync(60_000);
		expect(mocks.api).toHaveBeenCalledTimes(2);
	});

	test('creation, remote reconnection and local resolution revalidate the displayed result', async () => {
		const view = render(AdminAccess, { global });
		await vi.advanceTimersByTimeAsync(0);
		expect(view.queryByRole('link')).toBeNull();
		mocks.api.mockResolvedValueOnce([{ id: 'report' }]);
		channel.emit('newAbuseUserReport', {});
		await vi.advanceTimersByTimeAsync(250);
		expect(view.getByRole('link').getAttribute('href')).toBe('/admin/abuses');
		globalEvents.emit('abuseReportResolved');
		await vi.advanceTimersByTimeAsync(250);
		expect(view.queryByRole('link')).toBeNull();
		stream.emit('_connected_');
		await vi.advanceTimersByTimeAsync(250);
		expect(mocks.api).toHaveBeenCalledTimes(4);
	});

	test.each([{ compact: false }, { compact: true }, { compact: true, horizontal: true }])('preserves panel and queue links with accessible error recovery: %j', async props => {
		mocks.api.mockRejectedValueOnce(new Error('offline'));
		const view = render(AdminAccess, { props, global, slots: { default: '<a href="/admin">Panel</a>' } });
		expect(view.getByRole('link', { name: new RegExp(i18n.ts.loading) })).toBeTruthy();
		await vi.advanceTimersByTimeAsync(0);
		expect(view.getByRole('link', { name: 'Panel' }).getAttribute('href')).toBe('/admin');
		expect(view.getByRole('link', { name: new RegExp(i18n.ts.abuseReportsUpdateFailed) }).getAttribute('href')).toBe('/admin/abuses');
		mocks.api.mockResolvedValueOnce([{ id: 'report' }]);
		await fireEvent.click(view.getByRole('button', { name: `${i18n.ts.abuseReports}: ${i18n.ts.retry}` }));
		await vi.advanceTimersByTimeAsync(250);
		expect(view.getByRole('link', { name: new RegExp(i18n.ts.thereIsUnresolvedAbuseReportWarning) })).toBeTruthy();
		expect(view.queryByRole('button')).toBeNull();
	});

	test('the mobile menu exposes the pending state before the drawer opens', async () => {
		mocks.api.mockResolvedValue([{ id: 'report' }]);
		const view = render(MobileFooter, { global });
		await vi.advanceTimersByTimeAsync(0);
		await fireEvent.click(view.getByRole('button', { name: new RegExp(i18n.ts.thereIsUnresolvedAbuseReportWarning) }));
		expect(view.emitted('update:drawerMenuShowing')).toEqual([[true]]);
	});

	test('pagehide releases the channel; pageshow and visibility restore monitoring', async () => {
		render(Probe);
		await vi.advanceTimersByTimeAsync(0);
		window.dispatchEvent(new Event('pagehide'));
		expect(dispose).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(mocks.api).toHaveBeenCalledOnce();
		window.dispatchEvent(new Event('pageshow'));
		await vi.advanceTimersByTimeAsync(250);
		expect(useChannel).toHaveBeenCalledTimes(2);
		Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
		document.dispatchEvent(new Event('visibilitychange'));
		const count = mocks.api.mock.calls.length;
		await vi.advanceTimersByTimeAsync(120_000);
		expect(mocks.api).toHaveBeenCalledTimes(count);
		Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
		document.dispatchEvent(new Event('visibilitychange'));
		await vi.advanceTimersByTimeAsync(250);
		expect(mocks.api).toHaveBeenCalledTimes(count + 1);
	});

	test('a reactive account switch and permission revocation release the old session', async () => {
		let resolve!: (reports: unknown[]) => void;
		mocks.api.mockReturnValueOnce(new Promise(res => { resolve = res; }));
		const view = render(AdminAccess, { global });
		const oldSignal = mocks.api.mock.calls[0][3];
		session.user!.token = 'new-account-token';
		await vi.advanceTimersByTimeAsync(0);
		expect(oldSignal.aborted).toBe(true);
		expect(mocks.api.mock.calls[1][2]).toBe('new-account-token');
		resolve([{ id: 'old-private-report' }]);
		await vi.advanceTimersByTimeAsync(0);
		expect(view.queryByRole('link')).toBeNull();
		session.user!.isModerator = false;
		expect(dispose).toHaveBeenCalledTimes(2);
		window.dispatchEvent(new Event('focus'));
		await vi.advanceTimersByTimeAsync(60_000);
		expect(mocks.api).toHaveBeenCalledTimes(2);
	});

	test('accountChanging immediately clears and aborts pending session data', async () => {
		let resolve!: (reports: unknown[]) => void;
		mocks.api.mockReturnValueOnce(new Promise(res => { resolve = res; }));
		const view = render(AdminAccess, { global });
		globalEvents.emit('accountChanging');
		expect(mocks.api.mock.calls[0][3].aborted).toBe(true);
		resolve([{ id: 'old-private-report' }]);
		await vi.advanceTimersByTimeAsync(0);
		expect(view.queryByRole('link')).toBeNull();
		expect(dispose).toHaveBeenCalledOnce();
	});
});
