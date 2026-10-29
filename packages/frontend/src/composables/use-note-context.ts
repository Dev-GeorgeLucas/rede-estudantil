/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { onActivated, onBeforeUnmount, onDeactivated, shallowRef, watch } from 'vue';
import type { entities } from 'misskey-js';
import type { NoteUpdatedEvent } from 'misskey-js/streaming.types.js';
import { deletedNoteIds, globalEvents } from '@/events.js';
import { misskeyApi } from '@/utility/misskey-api.js';
import { store } from '@/store.js';
import { useStream } from '@/stream.js';

type ContextState = { id: string; status: 'loading' | 'deleted' | 'unavailable' | 'error'; note: null }
	| { id: string; status: 'available'; note: entities.Note };

function isUnavailable(error: unknown): boolean {
	if (typeof error !== 'object' || error == null) return false;
	const { code } = error as { code?: string };
	return ['NO_SUCH_NOTE', 'CONTENT_RESTRICTED_BY_USER', 'CONTENT_RESTRICTED_BY_SERVER', 'PERMISSION_DENIED', 'AUTHENTICATION_FAILED'].includes(code ?? '');
}

export function useNoteContext(noteId: () => string) {
	const state = shallowRef<ContextState>({ id: noteId(), status: 'loading', note: null });
	let request: AbortController | null = null;
	let generation = 0;
	let paused = false;
	const stream = store.s.realtimeMode ? useStream() : null;

	async function refresh() {
		request?.abort();
		const version = ++generation;
		const id = noteId();
		if (deletedNoteIds.has(id) || (state.value.id === id && state.value.status === 'deleted')) {
			state.value = { id, status: 'deleted', note: null };
			return;
		}
		// Do not display an embedded/cached parent while checking current access.
		state.value = { id, status: 'loading', note: null };
		if (paused) return;
		const controller = new AbortController();
		request = controller;
		try {
			const note = await misskeyApi('notes/show', { noteId: id }, undefined, controller.signal);
			if (version !== generation || controller.signal.aborted) return;
			state.value = note.isHidden ? { id, status: 'unavailable', note: null } : { id, status: 'available', note };
		} catch (error) {
			if (version !== generation || controller.signal.aborted) return;
			state.value = { id, status: isUnavailable(error) ? 'unavailable' : 'error', note: null };
		}
	}

	watch([noteId, () => deletedNoteIds.has(noteId())], refresh, { immediate: true, flush: 'sync' });

	watch(noteId, (id, _old, cleanup) => {
		if (!stream) return;
		const capture = () => stream.send('sr', { id });
		const updated = (event: NoteUpdatedEvent) => {
			if (event.id === id && event.type === 'deleted') globalEvents.emit('noteDeleted', id);
		};
		capture();
		stream.on('_connected_', capture);
		stream.on('noteUpdated', updated);
		cleanup(() => {
			stream.send('un', { id });
			stream.off('_connected_', capture);
			stream.off('noteUpdated', updated);
		});
	}, { immediate: true });

	onDeactivated(() => {
		paused = true;
		request?.abort();
		if (state.value.status !== 'deleted') state.value = { id: noteId(), status: 'loading', note: null };
	});
	onActivated(() => {
		if (!paused) return;
		paused = false;
		refresh();
	});
	onBeforeUnmount(() => request?.abort());
	return { state, refresh };
}
