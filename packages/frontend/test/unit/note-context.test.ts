/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { afterEach, expect, test, vi } from 'vitest';
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/vue';
import { EventEmitter } from 'eventemitter3';
import type { entities } from 'misskey-js';
import { useNoteContext } from '@/composables/use-note-context.js';
import { deletedNoteIds, globalEvents } from '@/events.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import MkNoteSub from '@/components/MkNoteSub.vue';

const stream = vi.hoisted(() => ({ send: vi.fn(), on: vi.fn(), off: vi.fn() }));
vi.mock('@/stream.js', () => ({ useStream: () => stream }));
vi.mock('@/store.js', () => ({ store: { s: { realtimeMode: true } } }));
vi.mock('@/utility/misskey-api.js', () => ({ misskeyApi: vi.fn() }));
vi.mock('@/i.js', () => ({ $i: null }));
vi.mock('@/utility/check-word-mute.js', () => ({ checkWordMute: () => false }));
vi.mock('@/components/MkNoteHeader.vue', () => ({ default: { template: '<div />' } }));
vi.mock('@/components/MkSubNoteContent.vue', () => ({ default: { props: ['note'], template: '<a :href="`/notes/${note.id}`">{{ note.text }}</a>' } }));
vi.mock('@/components/MkButton.vue', () => ({ default: { template: '<button><slot /></button>' } }));
vi.mock('@/components/MkCwButton.vue', () => ({ default: { template: '<div />' } }));
vi.mock('@/i18n.js', () => ({ i18n: { ts: {
	originalNoteDeleted: 'A publicação original foi excluída.',
	originalNoteUnavailable: 'A publicação original não está disponível.',
	somethingHappened: 'Erro temporário', retry: 'Tentar novamente', unavailable: 'Não disponível',
} } }));

const parent = { id: 'parent', text: 'Conteúdo autorizado', user: { id: 'user' }, files: [], cw: null } as unknown as entities.Note;

afterEach(() => {
	cleanup();
	deletedNoteIds.clear();
	vi.resetAllMocks();
});

function mountContext(id = ref('parent')) {
	let context!: ReturnType<typeof useNoteContext>;
	const component = defineComponent({ setup() {
		context = useNoteContext(() => id.value);
		return () => h('div');
	} });
	render(component);
	return context;
}

test('existing parent is loaded through the current permission-aware API', async () => {
	vi.mocked(misskeyApi).mockResolvedValueOnce(parent);
	const context = mountContext();
	await waitFor(() => expect(context.state.value.status).toBe('available'));
	expect(context.state.value.note).toEqual(parent);
});

test.each(['NO_SUCH_NOTE', 'CONTENT_RESTRICTED_BY_USER', 'CONTENT_RESTRICTED_BY_SERVER', 'PERMISSION_DENIED'])('%s means unavailable, never confirmed deletion', async code => {
	vi.mocked(misskeyApi).mockRejectedValueOnce({ code });
	const context = mountContext();
	await waitFor(() => expect(context.state.value.status).toBe('unavailable'));
	expect(context.state.value.note).toBeNull();
	expect(deletedNoteIds.has('parent')).toBe(false);
});

test('a hidden parent does not expose its user or cached content', async () => {
	vi.mocked(misskeyApi).mockResolvedValueOnce({ ...parent, isHidden: true });
	const context = mountContext();
	await waitFor(() => expect(context.state.value.status).toBe('unavailable'));
	expect(context.state.value.note).toBeNull();
});

test('network failures are retryable and do not become deletion evidence', async () => {
	vi.mocked(misskeyApi).mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(parent);
	const context = mountContext();
	await waitFor(() => expect(context.state.value.status).toBe('error'));
	await context.refresh();
	expect(context.state.value.status).toBe('available');
	expect(deletedNoteIds.size).toBe(0);
});

test.each(['RATE_LIMIT_EXCEEDED', 'INTERNAL_ERROR'])('%s keeps the retry action available', async code => {
	vi.mocked(misskeyApi).mockRejectedValueOnce({ code, kind: 'client' }).mockResolvedValueOnce(parent);
	const context = mountContext();
	await waitFor(() => expect(context.state.value.status).toBe('error'));
	await context.refresh();
	expect(context.state.value.status).toBe('available');
});

test('an explicit deletion wins over a late successful fetch', async () => {
	let resolve!: (note: entities.Note) => void;
	vi.mocked(misskeyApi).mockReturnValueOnce(new Promise<entities.Note>(r => { resolve = r; }));
	const context = mountContext();
	globalEvents.emit('noteDeleted', 'parent');
	resolve(parent);
	await nextTick();
	expect(context.state.value).toEqual({ id: 'parent', status: 'deleted', note: null });
	await context.refresh();
	expect(misskeyApi).toHaveBeenCalledTimes(1);
});

test('confirmed deletion remains known after a context is mounted again in the session', () => {
	globalEvents.emit('noteDeleted', 'parent');
	const context = mountContext();
	expect(context.state.value.status).toBe('deleted');
	expect(misskeyApi).not.toHaveBeenCalled();
});

test('server deletion events clear a displayed parent and subscriptions are cleaned up', async () => {
	const events = new EventEmitter();
	stream.on.mockImplementation((name, listener) => events.on(name, listener));
	stream.off.mockImplementation((name, listener) => events.off(name, listener));
	vi.mocked(misskeyApi).mockResolvedValueOnce(parent);
	const context = mountContext();
	await waitFor(() => expect(context.state.value.status).toBe('available'));
	events.emit('noteUpdated', { id: 'parent', type: 'deleted', body: { deletedAt: new Date().toISOString() } });
	expect(context.state.value.status).toBe('deleted');
	expect(context.state.value.note).toBeNull();
	cleanup();
	expect(events.listenerCount('noteUpdated')).toBe(0);
	expect(stream.send).toHaveBeenLastCalledWith('un', { id: 'parent' });
});

test('a cached conversation revalidates access before showing its parent again', async () => {
	vi.mocked(misskeyApi).mockResolvedValueOnce(parent).mockRejectedValueOnce({ code: 'NO_SUCH_NOTE' });
	const visible = ref(true);
	let context!: ReturnType<typeof useNoteContext>;
	const child = defineComponent({ setup() {
		context = useNoteContext(() => 'parent');
		return () => h('div');
	} });
	render(defineComponent({ setup: () => () => h(KeepAlive, null, { default: () => visible.value ? h(child) : null }) }));
	await waitFor(() => expect(context.state.value.status).toBe('available'));
	visible.value = false;
	await nextTick();
	expect(context.state.value.note).toBeNull();
	visible.value = true;
	await waitFor(() => expect(context.state.value.status).toBe('unavailable'));
	expect(misskeyApi).toHaveBeenCalledTimes(2);
});

test('switching the target ignores a stale response from the previous parent', async () => {
	let resolve!: (note: entities.Note) => void;
	vi.mocked(misskeyApi).mockReturnValueOnce(new Promise<entities.Note>(r => { resolve = r; })).mockResolvedValueOnce({ ...parent, id: 'other' });
	const id = ref('parent');
	const context = mountContext(id);
	id.value = 'other';
	await waitFor(() => expect(context.state.value.id).toBe('other'));
	resolve(parent);
	await nextTick();
	expect(context.state.value.note?.id).toBe('other');
});

test('deletion evidence is bounded and does not store original content', () => {
	for (let i = 0; i < 501; i++) globalEvents.emit('noteDeleted', String(i));
	expect(deletedNoteIds.size).toBe(500);
	expect(deletedNoteIds.has('0')).toBe(false);
	expect(deletedNoteIds.has('500')).toBe(true);
});

test('context UI never renders the embedded snapshot and removes the original link on deletion', async () => {
	vi.mocked(misskeyApi).mockResolvedValueOnce(parent);
	const view = render(MkNoteSub, {
		props: { note: { ...parent, text: 'CACHE ANTIGO' }, contextId: 'parent' },
		global: { stubs: { MkAvatar: true, MkLoading: true } },
	});
	expect(view.queryByText('CACHE ANTIGO')).toBeNull();
	await view.findByText('Conteúdo autorizado');
	globalEvents.emit('noteDeleted', 'parent');
	await view.findByText('A publicação original foi excluída.');
	expect(view.queryByRole('link')).toBeNull();
	expect(view.queryByText('Conteúdo autorizado')).toBeNull();
});

test('context UI offers retry for a temporary failure and a distinct unavailable message for 404', async () => {
	vi.mocked(misskeyApi).mockRejectedValueOnce(new TypeError('offline')).mockRejectedValueOnce({ code: 'NO_SUCH_NOTE' });
	const view = render(MkNoteSub, { props: { note: null, contextId: 'parent' }, global: { stubs: { MkLoading: true } } });
	await fireEvent.click(await view.findByRole('button', { name: 'Tentar novamente' }));
	await view.findByText('A publicação original não está disponível.');
	expect(view.queryByText('A publicação original foi excluída.')).toBeNull();
	expect(view.queryByRole('button')).toBeNull();
});
