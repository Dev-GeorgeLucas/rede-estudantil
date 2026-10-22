/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { expect, test, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { render, cleanup } from '@testing-library/vue';
import type * as Misskey from 'misskey-js';
import { useNoteCapture, noteEvents } from '@/composables/use-note-capture.js';
import { globalEvents } from '@/events.js';

vi.mock('@/i.js', () => ({ $i: { id: 'me' } }));
vi.mock('@/stream.js', () => ({ useStream: vi.fn() }));
vi.mock('@/store.js', () => ({ store: { s: { realtimeMode: false } } }));
vi.mock('@@/js/interval.js', () => ({ createVisibilityAwareInterval: vi.fn() }));

test('feed and detail reconcile independently and deduplicate subsequent events', () => {
	const note = { id: 'n', createdAt: '2020-01-01', reactions: {}, reactionCount: 0, reactionEmojis: {}, myReaction: null } as unknown as Misskey.entities.Note;
	const captures: ReturnType<typeof useNoteCapture>[] = [];
	const component = defineComponent({ setup() {
		captures.push(useNoteCapture({ note, parentNote: null, mock: true }));
		return () => h('div');
	} });
	render(component);
	render(component);
	noteEvents.emit('reconciled:n', { ...note, myReaction: '❤', reactions: { '❤': 1 }, reactionCount: 1 });
	noteEvents.emit('reacted:n', { userId: 'me', reaction: '❤️' });
	noteEvents.emit('reacted:n', { userId: 'other', reaction: '❤' });
	for (const { $note } of captures) {
		expect($note.reactions['❤']).toBe(2);
		expect($note.reactionCount).toBe(2);
		expect($note.myReaction).toBe('❤');
	}
	noteEvents.emit('unreacted:n', { userId: 'me', reaction: '❤' });
	for (const { $note } of captures) expect($note.reactions['❤']).toBe(1);
	cleanup();
	expect(noteEvents.listenerCount('reconciled:n')).toBe(0);
});

test('a submitted reply updates every parent counter once, without changing shared note data', () => {
	const note = { id: 'parent', createdAt: '2020-01-01', repliesCount: 2, reactions: {}, reactionCount: 0, reactionEmojis: {} } as Misskey.entities.Note;
	const captures: ReturnType<typeof useNoteCapture>[] = [];
	const component = defineComponent({ setup() {
		captures.push(useNoteCapture({ note, parentNote: null, mock: true }));
		return () => h('div');
	} });
	render(component);
	render(component);
	const reply = { id: 'reply', replyId: 'parent' } as Misskey.entities.Note;
	globalEvents.emit('notePosted', reply);
	globalEvents.emit('notePosted', reply);
	globalEvents.emit('notePosted', { id: 'nested', replyId: 'reply' } as Misskey.entities.Note);
	for (const { $note } of captures) expect($note.repliesCount).toBe(3);
	expect(note.repliesCount).toBe(2);
	cleanup();
	expect(globalEvents.listenerCount('notePosted')).toBe(0);
});
