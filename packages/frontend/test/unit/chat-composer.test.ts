/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/vue';
import { defineComponent, h, nextTick, ref, unref } from 'vue';
import type { Component } from 'vue';
import type * as Misskey from 'misskey-js';
import { preferState, preferReactive } from '../setup.unit.js';
import ChatComposer from '@/pages/chat/room.form.vue';
import { i18n } from '@/i18n.js';

const mocks = vi.hoisted(() => ({ api: vi.fn(), popup: vi.fn(), selectFile: vi.fn(), picker: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/utility/drive.js', () => ({ selectFile: mocks.selectFile }));
vi.mock('@/utility/emoji-picker.js', () => ({ emojiPicker: { show: mocks.picker } }));
vi.mock('@/os.js', () => ({ popup: mocks.popup, claimZIndex: () => 100, alert: vi.fn(), launchUploader: vi.fn() }));
vi.mock('@/local-storage.js', () => ({ miLocalStorage: localStorage }));
vi.mock('@/store.js', () => ({ store: { s: { additionalUnicodeEmojiIndexes: {}, recentlyUsedEmojis: [] }, set: vi.fn() } }));
vi.mock('@/custom-emojis.js', () => ({ customEmojis: ref([]) }));

const stubs = { MkLoading: true, MkUserName: true, MkEmoji: true, MkCustomEmoji: true };
const file = { id: 'file-id', name: 'photo.png' } as Misskey.entities.DriveFile;
function mountComposer(target: 'user' | 'room' = 'user') {
	const view = render(ChatComposer, {
		props: target === 'user' ? { user: { id: 'recipient' } as Misskey.entities.UserDetailed } : { room: { id: 'room-id' } as Misskey.entities.ChatRoom },
		global: { stubs },
	});
	return { ...view, textarea: view.getByPlaceholderText(i18n.ts.inputMessageHere) as HTMLTextAreaElement, send: view.getByTitle(i18n.ts.send) as HTMLButtonElement };
}
function press(el: Element, options: KeyboardEventInit = {}) {
	const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...options });
	el.dispatchEvent(ev);
	return ev;
}
function sends() {
	return mocks.api.mock.calls.filter(([endpoint]) => endpoint.startsWith('chat/messages/create-'));
}
function draft(text: string, attachment: Misskey.entities.DriveFile | null = null, target = 'user:recipient') {
	localStorage.setItem('chatMessageDrafts', JSON.stringify({ [target]: { data: { text, file: attachment } } }));
}

beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
	preferState['chat.sendOnEnter'] = true;
	preferReactive.emojiStyle = ref('twemoji');
	mocks.api.mockImplementation(async endpoint => {
		if (endpoint === 'users/search-by-username-and-host') return [{ id: 'alice', username: 'alice', host: null }];
		if (endpoint === 'hashtags/search') return ['testing'];
		return { id: 'message-id' };
	});
	// Mount the real autocomplete, preserving its target-level keyboard listener and completion callback.
	mocks.popup.mockImplementation((component: Component, props, events) => {
		const popup = render(defineComponent({ setup: () => () => h(component, {
			...Object.fromEntries(Object.entries(props).map(([key, value]) => [key, unref(value)])),
			onDone: events.done,
		}) }), { global: { stubs } });
		return { dispose: popup.unmount };
	});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

describe('Chat composer keyboard sending', () => {
	test.each(['user', 'room'] as const)('Enter sends once through the existing %s action and clears the successful draft', async target => {
		const view = mountComposer(target);
		await fireEvent.update(view.textarea, 'Hello\nworld');
		const event = press(view.textarea);
		expect(event.defaultPrevented).toBe(true);
		expect(sends()).toEqual([[`chat/messages/create-to-${target}`, {
			...(target === 'user' ? { toUserId: 'recipient' } : { toRoomId: 'room-id' }), text: 'Hello\nworld', fileId: undefined,
		}]]);
		await waitFor(() => expect(view.textarea.value).toBe(''));
	});

	test.each([true, false])('Shift+Enter leaves native newline insertion intact (preference %s)', async enabled => {
		preferState['chat.sendOnEnter'] = enabled;
		const view = mountComposer();
		await fireEvent.update(view.textarea, 'Hello');
		for (const modifiers of [{ shiftKey: true }, { shiftKey: true, ctrlKey: true }]) {
			expect(press(view.textarea, modifiers).defaultPrevented).toBe(false);
		}
		// happy-dom does not insert text as a default keyboard action; apply the browser's input.
		await fireEvent.update(view.textarea, 'Hello\n');
		expect(view.textarea.value).toBe('Hello\n');
		expect(sends()).toHaveLength(0);
	});

	test.each(['', '   ', '\n\t \u3000'])('blank text %j is disabled and never sends', async text => {
		const view = mountComposer();
		await fireEvent.update(view.textarea, text);
		press(view.textarea);
		await fireEvent.click(view.send);
		expect(view.send.disabled).toBe(true);
		expect(sends()).toHaveLength(0);
	});

	test.each(['', 'Caption', '   '])('restored attachment with text %j keeps its existing payload', async text => {
		draft(text, file);
		const view = mountComposer();
		await nextTick();
		press(view.textarea);
		expect(sends()[0]).toEqual(['chat/messages/create-to-user', { toUserId: 'recipient', text: text || undefined, fileId: file.id }]);
		await waitFor(() => expect(view.queryByText(file.name)).toBeNull());
	});

	test('attachment selected through the existing button still sends without text', async () => {
		mocks.selectFile.mockResolvedValue(file);
		const view = mountComposer();
		await fireEvent.click(view.container.querySelector('button')!);
		await waitFor(() => expect(view.queryByText(file.name)).not.toBeNull());
		await fireEvent.click(view.send);
		expect(sends()[0][1]).toEqual({ toUserId: 'recipient', text: undefined, fileId: file.id });
	});

	test.each([{ isComposing: true }, { keyCode: 229 }, { key: 'Process' }])('IME event %j does not send or cancel composition', async options => {
		const view = mountComposer();
		await fireEvent.update(view.textarea, 'こんにちは');
		expect(press(view.textarea, options).defaultPrevented).toBe(false);
		expect(sends()).toHaveLength(0);
	});

	test('composition lifecycle protects Enter even when isComposing is missing', async () => {
		const view = mountComposer();
		await fireEvent.update(view.textarea, 'こんにちは');
		await fireEvent.compositionStart(view.textarea);
		press(view.textarea);
		expect(sends()).toHaveLength(0);
		await fireEvent.compositionEnd(view.textarea);
		press(view.textarea);
		expect(sends()).toHaveLength(1);
	});

	test.each(['@ali', ':smile', '#test', '$[bo'])('Enter selecting real autocomplete for %s never sends', async input => {
		const view = mountComposer();
		await fireEvent.update(view.textarea, input);
		await waitFor(() => expect(document.querySelectorAll('li').length).toBeGreaterThan(input.startsWith('@') ? 1 : 0));
		await nextTick();
		press(view.textarea, { key: 'ArrowDown' });
		await nextTick();
		expect(document.querySelector('[data-selected]')).not.toBeNull();
		// Some browsers keep the text field focused while a suggestion is selected.
		view.textarea.focus();
		const event = press(view.textarea);
		expect(event.defaultPrevented).toBe(true);
		expect(sends()).toHaveLength(0);
		await waitFor(() => expect(view.textarea.value).not.toBe(input));
		press(view.textarea);
		expect(sends()).toHaveLength(1);
	});

	test('another target handler consuming Enter also prevents sending', async () => {
		const view = mountComposer();
		await fireEvent.update(view.textarea, 'Hello');
		view.textarea.addEventListener('keydown', event => event.preventDefault(), { once: true });
		press(view.textarea);
		expect(sends()).toHaveLength(0);
	});

	test.each(['user', 'room'] as const)('pending %s request prevents repeated Enter and button submissions', async target => {
		let resolve!: (value: unknown) => void;
		mocks.api.mockImplementation(() => new Promise(done => { resolve = done; }));
		const view = mountComposer(target);
		await fireEvent.update(view.textarea, 'Hello');
		press(view.textarea);
		press(view.textarea);
		press(view.textarea, { repeat: true });
		// Click before Vue has updated the disabled attribute to exercise the action guard.
		view.send.click();
		expect(sends()).toHaveLength(1);
		await nextTick();
		expect(view.send.disabled).toBe(true);
		resolve({ id: 'sent' });
		await waitFor(() => expect(view.textarea.value).toBe(''));
		await fireEvent.update(view.textarea, 'Next');
		press(view.textarea, { repeat: true });
		expect(sends()).toHaveLength(1);
		press(view.textarea);
		expect(sends()).toHaveLength(2);
		resolve({ id: 'next' });
	});

	test.each(['user', 'room'] as const)('%s failure keeps text, attachment and draft for retry using the Send button', async target => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		mocks.api.mockRejectedValueOnce(new Error('Network failure'));
		const key = target === 'user' ? 'user:recipient' : 'room:room-id';
		draft('Try again', file, key);
		const view = mountComposer(target);
		await nextTick();
		press(view.textarea);
		await nextTick();
		await waitFor(() => expect(view.send.disabled).toBe(false));
		expect(view.textarea.value).toBe('Try again');
		expect(view.queryByText(file.name)).not.toBeNull();
		expect(JSON.parse(localStorage.getItem('chatMessageDrafts')!)[key].data).toEqual({ text: 'Try again', file });
		await fireEvent.click(view.send);
		expect(sends()).toHaveLength(2);
		await waitFor(() => expect(view.textarea.value).toBe(''));
	});

	test('disabled preference preserves mobile newlines and Ctrl/Meta+Enter shortcuts', async () => {
		preferState['chat.sendOnEnter'] = false;
		const view = mountComposer();
		await fireEvent.update(view.textarea, 'Mobile message');
		expect(press(view.textarea).defaultPrevented).toBe(false);
		await fireEvent.update(view.textarea, 'Mobile message\n');
		expect(sends()).toHaveLength(0);
		expect(press(view.textarea, { ctrlKey: true }).defaultPrevented).toBe(true);
		await waitFor(() => expect(view.textarea.value).toBe(''));
		await fireEvent.update(view.textarea, 'Another');
		expect(press(view.textarea, { metaKey: true }).defaultPrevented).toBe(true);
		expect(sends()).toHaveLength(2);
	});

	test.each([{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { key: 'Tab' }])('enabled preference leaves unrelated key %j alone', async options => {
		const view = mountComposer();
		await fireEvent.update(view.textarea, 'Hello');
		expect(press(view.textarea, options).defaultPrevented).toBe(false);
		expect(sends()).toHaveLength(0);
	});

	test('keyboard events on buttons keep native handling and do not trigger the textarea shortcut', async () => {
		const view = mountComposer();
		await fireEvent.update(view.textarea, 'Hello');
		view.send.focus();
		expect(document.activeElement).toBe(view.send);
		expect(press(view.send).defaultPrevented).toBe(false);
		expect(sends()).toHaveLength(0);
		await fireEvent.click(view.send);
		expect(sends()).toHaveLength(1);
	});
});
