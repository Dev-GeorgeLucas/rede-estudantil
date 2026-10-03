/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/vue';
import { nextTick } from 'vue';
import locales from 'i18n';
import type * as Misskey from 'misskey-js';
import type { MenuButton, MenuItem, MenuParent, MenuSwitch } from '@/types/menu.js';
import UserHome from '@/pages/user/home.vue';
import { getUserChatLink, getUserMenu } from '@/utility/get-user-menu.js';
import { i18n, updateI18n } from '@/i18n.js';

const session = vi.hoisted(() => ({
	user: null as null | { id: string; isAdmin: boolean; isModerator: boolean; policies: { chatAvailability: string } },
	api: vi.fn(), write: vi.fn(), popupMenu: vi.fn(), popup: vi.fn(), form: vi.fn(), post: vi.fn(),
	pushByPath: vi.fn(), push: vi.fn(), activity: vi.fn(), lists: vi.fn(), copy: vi.fn(),
}));
vi.mock('@/i.js', () => ({
	get $i() { return session.user; },
	get iAmModerator() { return !!(session.user?.isAdmin || session.user?.isModerator); },
}));
vi.mock('@/os.js', () => ({
	apiWithDialog: session.write, popupMenu: session.popupMenu, popupAsyncWithDialog: session.popup,
	form: session.form, post: session.post,
	confirm: vi.fn(async () => ({ canceled: false })),
	select: vi.fn(async () => ({ canceled: false, result: 'indefinitely' })),
}));
vi.mock('@/router.js', () => ({
	useRouter: () => ({ pushByPath: session.pushByPath, push: session.push }),
	mainRouter: { pushByPath: session.pushByPath, push: session.push },
}));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: session.api }));
vi.mock('@/utility/check-permissions.js', () => ({ notesSearchAvailable: true, canSearchNonLocalNotes: true }));
vi.mock('@/utility/copy-to-clipboard.js', () => ({ copyToClipboard: session.copy }));
vi.mock('@/utility/get-embed-code.js', () => ({ genEmbedCode: vi.fn() }));
vi.mock('@/utility/confetti.js', () => ({ confetti: vi.fn() }));
vi.mock('@/utility/is-birthday.js', () => ({ isBirthday: () => false }));
vi.mock('@/plugin.js', () => ({ getPluginHandlers: () => [] }));
vi.mock('@/cache.js', () => ({ userListsCache: { fetch: session.lists }, antennasCache: {}, rolesCache: {} }));
vi.mock('@/components/MkFollowButton.vue', () => ({ __esModule: true, default: { template: '<button data-follow>Follow</button>' } }));
vi.mock('@/components/MkNote.vue', () => ({ __esModule: true, default: { template: '<div />' } }));
vi.mock('@/components/MkAbuseReportWindow.vue', () => ({ __esModule: true, default: {} }));
vi.mock('@/components/MkAccountMoved.vue', () => ({ __esModule: true, default: { template: '<div />' } }));
vi.mock('@/components/MkRemoteCaution.vue', () => ({ __esModule: true, default: { template: '<div />' } }));
vi.mock('@/components/MkTextarea.vue', () => ({ __esModule: true, default: { template: '<textarea />' } }));
vi.mock('@/components/MkButton.vue', () => ({ __esModule: true, default: { template: '<button><slot /></button>' } }));
vi.mock('@/components/MkOmit.vue', () => ({ __esModule: true, default: { template: '<div><slot /></div>' } }));
vi.mock('@/components/MkPullToRefresh.vue', () => ({ __esModule: true, default: { template: '<div><slot /></div>' } }));
vi.mock('@/pages/user/index.files.vue', () => ({ __esModule: true, default: { template: '<div>Profile files</div>' } }));
vi.mock('@/pages/user/index.activity.vue', () => ({ __esModule: true, default: { setup: session.activity, template: '<div>Activity chart</div>' } }));
vi.mock('@/pages/user/index.timeline.vue', () => ({ __esModule: true, default: { template: '<div>Timeline</div>' } }));

const roles = ['visitor', 'user', 'moderator', 'admin'] as const;
function setRole(role: typeof roles[number]) {
	session.user = role === 'visitor' ? null : { id: 'viewer', isAdmin: role === 'admin', isModerator: role === 'moderator', policies: { chatAvailability: 'available' } };
}
function profile(overrides: Partial<Misskey.entities.UserDetailed> = {}): Misskey.entities.UserDetailed {
	return {
		id: 'student', username: 'student', name: 'Student', host: null, roles: [], fields: [], pinnedNotes: [],
		createdAt: '2020-01-01T00:00:00.000Z', canChat: true, isBlocking: false, isBlocked: false,
		isMuted: false, isRenoteMuted: true, isFollowing: true, isFollowed: true, notify: 'none', withReplies: true,
		memo: 'Saved personal memo', moderationNote: '', notesCount: 12, followingCount: 5, followersCount: 7,
		...overrides,
	} as Misskey.entities.UserDetailed;
}
function renderProfile(user = profile(), width = 390) {
	window.innerWidth = width;
	vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
	return render(UserHome, {
		props: { user, disableNotes: true },
		global: {
			stubs: { MkAvatar: true, MkUserName: true, MkAcct: true, MkTime: true, Mfm: true, MkA: true, MkLazy: { template: '<div><slot /></div>' } },
			directives: { tooltip: (el, binding) => { el.title = binding.value; }, 'adaptive-bg': () => {} },
		},
	});
}
function labels(menu: MenuItem[]) {
	return menu.flatMap(item => 'text' in item ? [item.text] : []);
}
function action(menu: MenuItem[], text: string) {
	const item = menu.find(item => 'text' in item && item.text === text);
	expect(item).toHaveProperty('action');
	return (item as MenuButton).action(new PointerEvent('click'));
}

beforeEach(() => {
	setRole('user');
	session.api.mockResolvedValue({ memo: 'Saved personal memo' });
	session.write.mockResolvedValue(undefined);
	session.popupMenu.mockResolvedValue(undefined);
	session.popup.mockResolvedValue({ dispose: vi.fn() });
	session.form.mockResolvedValue({ canceled: false, result: { memo: 'Updated memo' } });
	session.lists.mockResolvedValue([{ id: 'saved-list', name: 'Personal list', userIds: [] }]);
});
afterEach(() => { cleanup(); updateI18n(locales['en-US']); vi.restoreAllMocks(); vi.clearAllMocks(); });

describe('MVP profile actions', () => {
	test.each(['pt-BR', 'en-US'])('%s: Chat uses the existing translated startChat label and tooltip', async locale => {
		updateI18n(locales[locale]);
		const label = locale === 'pt-BR' ? 'Iniciar conversa' : locales['en-US'].startChat;
		const view = renderProfile();
		await waitFor(() => expect(view.queryByText('Profile files')).not.toBeNull());
		const chat = view.getByRole('button', { name: label });
		expect(chat.getAttribute('aria-label')).toBe(label);
		expect(chat.getAttribute('title')).toBe(label);
	});

	test.each(roles.flatMap(role => [false, true].flatMap(own => [null, 'remote.test'].flatMap(host => [390, 1440].map(width => ({ role, own, host, width }))))))('$role own=$own host=$host at $width px: Chat, menu, memo and activity', async ({ role, own, host, width }) => {
		setRole(role);
		const user = profile({ id: own ? 'viewer' : 'student', host });
		const saved = structuredClone(user);
		const view = renderProfile(user, width);
		await waitFor(() => expect(view.queryByText('Profile files')).not.toBeNull());
		expect(view.container.querySelector('.ftskorzw')?.classList.contains('wide')).toBe(width >= 1000);
		expect(view.queryByText('Activity chart')).toBeNull();
		expect(session.activity).not.toHaveBeenCalled();
		expect(view.container.querySelector('.add-note-button')).toBeNull();
		expect(view.container.querySelector('.memo')).toBeNull();
		const chat = view.queryByRole('button', { name: i18n.ts.startChat });
		if (role !== 'visitor' && !own && host == null) {
			expect(chat).not.toBeNull();
			expect(chat!.getAttribute('title')).toBe(i18n.ts.startChat);
			expect(chat!.getAttribute('type')).toBe('button');
			expect(chat!.querySelector('.ti-messages')?.getAttribute('aria-hidden')).toBe('true');
			const actions = view.container.querySelector('.actions')!;
			expect(Array.from(actions.children)).toEqual([view.getByRole('button', { name: i18n.ts.more }), chat, actions.querySelector('[data-follow]')]);
			chat!.focus();
			expect(document.activeElement).toBe(chat);
			await fireEvent.click(chat!);
			expect(session.pushByPath).toHaveBeenCalledExactlyOnceWith('/chat/user/student');
		} else {
			expect(chat).toBeNull();
		}
		await fireEvent.click(view.getByRole('button', { name: i18n.ts.more }));
		const menu = session.popupMenu.mock.calls[0][0] as MenuItem[];
		const texts = labels(menu);
		for (const text of [i18n.ts.embed, i18n.ts.roles, i18n.ts.showRepliesToOthersInTimeline, i18n.ts.createUserSpecifiedNote, i18n.ts.renoteMute, i18n.ts.renoteUnmute, i18n.ts._chat.chatWithThisUser]) expect(texts).not.toContain(text);
		for (const text of [i18n.ts.copyUsername, i18n.ts.copyProfileUrl]) expect(texts).toContain(text);
		expect(texts.includes(i18n.ts.moderation)).toBe(role === 'admin' || role === 'moderator');
		for (const text of [i18n.ts.editMemo, i18n.ts.addToList]) expect(texts.includes(text)).toBe(role !== 'visitor');
		for (const text of [i18n.ts.notifyNotes, i18n.ts.mute, i18n.ts.block, i18n.ts.breakFollow, i18n.ts.reportAbuse]) expect(texts.includes(text)).toBe(role !== 'visitor' && !own);
		expect(user).toEqual(saved);
		expect(session.api).not.toHaveBeenCalled();
		expect(session.write).not.toHaveBeenCalled();
		expect(session.post).not.toHaveBeenCalled();
	});

	test.each([
		{ canChat: false }, { isBlocking: true }, { isBlocked: true },
	])('Chat unavailable for %j', async overrides => {
		const user = profile(overrides);
		expect(getUserChatLink(user)).toBeNull();
		const view = renderProfile(user);
		await nextTick();
		expect(view.queryByRole('button', { name: i18n.ts.startChat })).toBeNull();
	});

	test.each(['unavailable', 'readOnly'])('viewer Chat policy %s hides the button', async policy => {
		session.user!.policies.chatAvailability = policy;
		const view = renderProfile();
		await nextTick();
		expect(view.queryByRole('button', { name: i18n.ts.startChat })).toBeNull();
	});

	test('blocking from the preserved menu immediately hides Chat and retains unblock', async () => {
		const view = renderProfile();
		await fireEvent.click(view.getByRole('button', { name: i18n.ts.more }));
		await action(session.popupMenu.mock.calls[0][0], i18n.ts.block);
		await waitFor(() => expect(view.queryByRole('button', { name: i18n.ts.startChat })).toBeNull());
		expect(session.write).toHaveBeenCalledWith('blocking/create', { userId: 'student' });
		await fireEvent.click(view.getByRole('button', { name: i18n.ts.more }));
		expect(labels(session.popupMenu.mock.calls[1][0])).toContain(i18n.ts.unblock);
	});

	test('memo, mute, notifications, remove follower, report and personal lists keep their original actions', async () => {
		const user = profile();
		const { menu, cleanup: dispose } = getUserMenu(user);
		await action(menu, i18n.ts.editMemo);
		expect(session.form.mock.calls[0][1].memo.default).toBe('Saved personal memo');
		expect(session.write).toHaveBeenCalledWith('users/update-memo', { userId: user.id, memo: 'Updated memo' });
		await action(menu, i18n.ts.mute);
		expect(session.write).toHaveBeenCalledWith('mute/create', { userId: user.id, expiresAt: null });
		await action(menu, i18n.ts.notifyNotes);
		expect(session.write).toHaveBeenCalledWith('following/update', { userId: user.id, notify: 'normal' });
		await action(menu, i18n.ts.breakFollow);
		expect(session.write).toHaveBeenCalledWith('following/invalidate', { userId: user.id });
		await action(menu, i18n.ts.reportAbuse);
		expect(session.popup).toHaveBeenCalledWith(expect.any(Promise), { user }, expect.any(Object));
		const lists = menu.find(item => 'text' in item && item.text === i18n.ts.addToList) as MenuParent;
		const children = await (lists.children as () => Promise<MenuItem[]>)();
		(children[0] as MenuSwitch).ref.value = true;
		await nextTick();
		expect(session.write).toHaveBeenCalledWith('users/lists/push', { userId: user.id, listId: 'saved-list' });
		expect(user.withReplies).toBe(true);
		expect(user.isRenoteMuted).toBe(true);
		dispose();
	});

	test.each(['moderator', 'admin'] as const)('%s retains moderation navigation', async role => {
		setRole(role);
		const { menu, cleanup: dispose } = getUserMenu(profile());
		await action(menu, i18n.ts.moderation);
		expect(session.push).toHaveBeenCalledWith('/admin/user/:userId', { params: { userId: 'student' } });
		dispose();
	});
});
