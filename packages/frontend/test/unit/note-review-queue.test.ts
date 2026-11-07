/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/vue';
import { nextTick } from 'vue';
import Queue from '@/pages/admin/note-reviews.queue.vue';
import { globalEvents } from '@/events.js';
import { i18n } from '@/i18n.js';

const mocks = vi.hoisted(() => ({ api: vi.fn(), paginator: null as any }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: mocks.api }));
vi.mock('@/components/MkInfo.vue', () => ({ default: { template: '<p role="status"><slot/></p>' } }));
vi.mock('@/components/MkButton.vue', () => ({ default: { template: '<button><slot/></button>' } }));
vi.mock('@/components/MkPagination.vue', () => ({ default: { props: ['paginator'], setup(props: any) { mocks.paginator = props.paginator; return {}; }, template: '<slot :items="paginator.items.value"/>' } }));
vi.mock('@/pages/admin/note-review.vue', () => ({ default: { props: ['review'], emits: ['resolved'], data: () => ({ outcome: '' }), template: '<article><p>{{ review.id }} {{ review.state }}</p><label>Outcome<select v-model="outcome"><option value=""></option><option value="reviewed">Reviewed</option></select></label><button @click="$emit(\'resolved\', review.id)">Resolve</button></article>' } }));

const review = (id: string, state = 'pending') => ({ id, noteId: id, state, createdAt: '2026-01-01T00:00:00.000Z', matchedWords: ['termoalfa'], resolvedAt: null, resolvedById: null, resolution: null });
beforeEach(() => {
	vi.useFakeTimers();
	Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
	mocks.api.mockReset().mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); });

test('background revalidation retains loaded pages, the selected outcome and keyboard focus', async () => {
	const view = render(Queue);
	const paginator = mocks.paginator;
	paginator.fetching.value = false;
	paginator.items.value = [review('z'), review('y'), review('x')];
	await nextTick();
	const select = view.getAllByRole('combobox', { name: 'Outcome' })[1] as HTMLSelectElement;
	await fireEvent.update(select, 'reviewed'); select.focus();
	const reload = vi.spyOn(paginator, 'reload');
	mocks.api.mockImplementation(async (_endpoint, params) => params.caseIds ? [review('z'), { ...review('y', 'resolved'), resolution: 'reviewed', resolvedById: 'othermod' }, review('x')] : [review('zz')]);
	globalEvents.emit('noteReviewsChanged');
	await vi.advanceTimersByTimeAsync(250); await nextTick();
	expect(reload).not.toHaveBeenCalled();
	expect(paginator.items.value.map((item: any) => item.id)).toEqual(['z', 'y', 'x']);
	expect(select.value).toBe('reviewed');
	expect(document.activeElement).toBe(select);
	expect(view.getByText('y resolved')).toBeTruthy();
	expect(view.getByRole('button', { name: i18n.ts._noteReview.newCases })).toBeTruthy();
	expect(mocks.api).toHaveBeenCalledWith('admin/note-reviews', { state: 'all', limit: 100, caseIds: ['z', 'y', 'x'] }, undefined, expect.any(AbortSignal));
});

test('failure preserves loaded cases, exposes recovery and stops querying while hidden', async () => {
	const view = render(Queue);
	mocks.paginator.fetching.value = false;
	mocks.paginator.items.value = [review('z')]; await nextTick();
	mocks.api.mockRejectedValue(new Error('offline'));
	await vi.advanceTimersByTimeAsync(60_000);
	expect(view.getByText('z pending')).toBeTruthy();
	expect(view.getByText(i18n.ts._noteReview.updateFailed)).toBeTruthy();
	Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
	const count = mocks.api.mock.calls.length;
	await vi.advanceTimersByTimeAsync(120_000);
	expect(mocks.api).toHaveBeenCalledTimes(count);
	mocks.api.mockResolvedValue([review('z')]);
	Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
	document.dispatchEvent(new Event('visibilitychange'));
	await vi.advanceTimersByTimeAsync(250);
	expect(view.queryByText(i18n.ts._noteReview.updateFailed)).toBeNull();
});

test('unmount aborts a refresh, clears timers and ignores a delayed response', async () => {
	let resolve!: (items: unknown[]) => void;
	mocks.api.mockReturnValue(new Promise(res => { resolve = res; }));
	const view = render(Queue);
	mocks.paginator.fetching.value = false;
	mocks.paginator.items.value = [review('z')];
	globalEvents.emit('noteReviewsChanged'); await vi.advanceTimersByTimeAsync(250);
	const signal = mocks.api.mock.calls[0][3];
	view.unmount();
	expect(signal.aborted).toBe(true);
	expect(vi.getTimerCount()).toBe(0);
	resolve([review('z', 'resolved')]); await vi.advanceTimersByTimeAsync(0);
	expect(mocks.paginator.items.value[0].state).toBe('pending');
});

test('resolving the last loaded case follows the original cursor instead of hiding older pending cases', async () => {
	mocks.api.mockImplementation(async (_endpoint, params) => params.untilId ? [review('y')] : [review('z')]);
	const view = render(Queue);
	await mocks.paginator.init(); await nextTick();
	await fireEvent.click(view.getByRole('button', { name: 'Resolve' }));
	await vi.advanceTimersByTimeAsync(0); await nextTick();
	expect(view.getByText('y pending')).toBeTruthy();
	expect(view.queryByText('z pending')).toBeNull();
	expect(mocks.api).toHaveBeenLastCalledWith('admin/note-reviews', expect.objectContaining({ state: 'pending', untilId: 'z' }));
	expect(document.activeElement).toBe(view.getByRole('combobox', { name: i18n.ts.state }));
});
