/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { expect, test } from 'vitest';
import { shouldOpenNote } from '@/utility/note-navigation.js';

function click(target: HTMLElement, selection = '') {
	const event = new MouseEvent('click', { bubbles: true, cancelable: true });
	target.dispatchEvent(event);
	return shouldOpenNote(event, selection);
}

test('noninteractive text opens the conversation', () => {
	expect(click(document.createElement('p'))).toBe(true);
});

test.each(['a', 'button', 'textarea', 'input', 'video', 'audio', 'img', 'summary'])('%s keeps its own action', tag => {
	const parent = document.createElement(tag);
	const child = document.createElement('span');
	parent.append(child);
	expect(click(child)).toBe(false);
});

test('selected text is safe to copy', () => {
	expect(click(document.createElement('p'), 'selected text')).toBe(false);
});

test('media and embedded interactive content never navigate the post', () => {
	const target = document.createElement('div');
	target.dataset.noteInteractive = '';
	expect(click(target)).toBe(false);
});

test('consumed events do not open the conversation', () => {
	const target = document.createElement('p');
	target.addEventListener('click', event => event.preventDefault());
	expect(click(target)).toBe(false);
});
