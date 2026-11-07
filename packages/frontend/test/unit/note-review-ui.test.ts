/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/vue';
import Review from '@/pages/admin/note-review.vue';
import { deletedNoteIds, globalEvents } from '@/events.js';
import { i18n } from '@/i18n.js';

const mocks = vi.hoisted(() => ({ api: vi.fn(), alert: vi.fn() }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/os.js', () => ({ alert: mocks.alert }));
vi.mock('@/components/MkNote.vue', () => ({ default: { props: ['note'], template: '<p>{{ note.text }}</p>' } }));
vi.mock('@/components/MkButton.vue', () => ({ default: { props: ['disabled'], template: '<button :disabled="disabled"><slot/></button>' } }));

const review = { id: 'review1', noteId: 'note1', createdAt: '2026-01-01T00:00:00.000Z', matchedWords: ['termoalfa'], state: 'pending' as const, resolvedById: null, resolvedAt: null, resolution: null };
const global = { components: { MkA: { props: ['to'], template: '<a :href="to"><slot/></a>' }, MkLoading: { template: '<p role="status">Loading</p>' } } };
beforeEach(() => { deletedNoteIds.clear(); mocks.api.mockReset().mockResolvedValue({ id: 'note1', text: 'current publication' }); mocks.alert.mockReset().mockResolvedValue({}); });
afterEach(cleanup);

test('loads current content with the existing endpoint and keeps the automatic origin explicit', async () => {
	const view = render(Review, { props: { review }, global });
	await view.findByText('current publication');
	expect(mocks.api).toHaveBeenCalledWith('notes/show', { noteId: 'note1' }, undefined, expect.any(AbortSignal));
	expect(view.getByRole('link').getAttribute('href')).toBe('/notes/note1');
	expect(view.getByRole('article', { name: i18n.ts._noteReview.automatic })).toBeTruthy();
	expect(view.getByRole('combobox', { name: i18n.ts._noteReview.outcome })).toBeTruthy();
	expect((view.getByRole('button', { name: i18n.ts._noteReview.close }) as HTMLButtonElement).disabled).toBe(true);
});

test('null reference means deleted and never queries or restores the note', async () => {
	const view = render(Review, { props: { review: { ...review, noteId: null } }, global });
	expect(view.getByText(i18n.ts.deletedNote)).toBeTruthy();
	expect(mocks.api).not.toHaveBeenCalled();
});

test.each(['network', 'not-found', 'hidden'])('%s is unavailable without claiming deletion, and supports retry', async reason => {
	if (reason === 'hidden') mocks.api.mockResolvedValueOnce({ id: 'note1', isHidden: true, text: 'must not reveal' });
	else mocks.api.mockRejectedValueOnce(reason === 'not-found' ? { code: 'NO_SUCH_NOTE' } : new Error('offline'));
	const view = render(Review, { props: { review }, global });
	await view.findByText(i18n.ts.unavailable);
	expect(view.queryByText(i18n.ts.deletedNote)).toBeNull();
	expect(view.queryByText('must not reveal')).toBeNull();
	await fireEvent.click(view.getByRole('button', { name: i18n.ts.retry }));
	await view.findByText('current publication');
});

test('an explicit deletion clears content and ignores an older in-flight response', async () => {
	let resolve!: (value: unknown) => void;
	mocks.api.mockReturnValueOnce(new Promise(res => { resolve = res; }));
	const view = render(Review, { props: { review }, global });
	globalEvents.emit('noteDeleted', 'note1');
	resolve({ id: 'note1', text: 'stale content' });
	await view.findByText(i18n.ts.deletedNote);
	expect(view.queryByText('stale content')).toBeNull();
});

test('an explicit decision submits once, reports a concurrent winner, and updates the displayed result', async () => {
	const view = render(Review, { props: { review: { ...review, noteId: null } }, global });
	let resolve!: (value: unknown) => void;
	mocks.api.mockReturnValueOnce(new Promise(res => { resolve = res; }));
	await fireEvent.update(view.getByRole('combobox'), 'reviewed');
	const button = view.getByRole('button', { name: i18n.ts._noteReview.close });
	await fireEvent.click(button); await fireEvent.click(button);
	expect(mocks.api).toHaveBeenCalledTimes(1);
	expect(mocks.api).toHaveBeenCalledWith('admin/resolve-note-review', { caseId: 'review1', resolution: 'reviewed' });
	resolve({ ...review, state: 'resolved', resolvedById: 'first-moderator', resolvedAt: review.createdAt, resolution: 'falsePositive', alreadyResolved: true });
	await view.findByText(i18n.ts._noteReview.falsePositive);
	expect(mocks.alert).toHaveBeenCalledWith({ type: 'info', text: i18n.ts._noteReview.alreadyResolved });
	await waitFor(() => expect(view.emitted('resolved')).toEqual([['review1']]));
});

test('a failed resolution retains the pending case and selected outcome for retry', async () => {
	mocks.api.mockRejectedValueOnce(new Error('offline'));
	const view = render(Review, { props: { review: { ...review, noteId: null } }, global });
	await fireEvent.update(view.getByRole('combobox'), 'unavailable');
	await fireEvent.click(view.getByRole('button', { name: i18n.ts._noteReview.close }));
	await waitFor(() => expect(mocks.alert).toHaveBeenCalled());
	expect((view.getByRole('combobox') as HTMLSelectElement).value).toBe('unavailable');
	expect(view.emitted('resolved')).toBeUndefined();
});

test('a remotely resolved case moves keyboard focus to its result instead of losing it', async () => {
	const view = render(Review, { props: { review: { ...review, noteId: null } }, global });
	const control = view.getByRole('combobox', { name: i18n.ts._noteReview.outcome });
	control.focus();
	await view.rerender({ review: { ...review, noteId: null, state: 'resolved', resolution: 'reviewed', resolvedById: 'other-mod', resolvedAt: review.createdAt } });
	await waitFor(() => expect(document.activeElement).toBe(view.getByRole('status')));
});
