/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { EventEmitter } from 'eventemitter3';
import * as Misskey from 'misskey-js';
import { onBeforeUnmount, shallowReactive } from 'vue';

type Events = {
	accountChanging: () => void;
	abuseReportResolved: () => void;
	clientNotification: (notification: Misskey.entities.Notification) => void;
	notePosted: (note: Misskey.entities.Note) => void;
	noteDeleted: (noteId: Misskey.entities.Note['id']) => void;
	noteRemovedFromAntenna: (antennaId: Misskey.entities.Antenna['id'], noteId: Misskey.entities.Note['id']) => void;
	driveFileCreated: (file: Misskey.entities.DriveFile) => void;
	driveFilesUpdated: (files: Misskey.entities.DriveFile[]) => void;
	driveFilesDeleted: (files: Misskey.entities.DriveFile[]) => void;
	driveFoldersUpdated: (folders: Misskey.entities.DriveFolder[]) => void;
	driveFoldersDeleted: (folders: Misskey.entities.DriveFolder[]) => void;
};

export const globalEvents = new EventEmitter<Events>();

// Evidence from successful deletion actions / explicit server events only.
// Session-local and bounded; a missing note or a 404 must never populate this set.
export const deletedNoteIds = shallowReactive(new Set<string>());
globalEvents.on('noteDeleted', id => {
	deletedNoteIds.add(id);
	if (deletedNoteIds.size > 500) deletedNoteIds.delete(deletedNoteIds.values().next().value!);
});

export function useGlobalEvent<T extends keyof Events>(
	event: T,
	callback: EventEmitter.EventListener<Events, T>,
): void {
	globalEvents.on(event, callback);
	onBeforeUnmount(() => {
		globalEvents.off(event, callback);
	});
}
