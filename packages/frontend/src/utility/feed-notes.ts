/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { entities } from 'misskey-js';

// Feed policy only. Mentions do not make a note a reply.
export function isFeedNote(note: entities.Note): boolean {
	const visited = new Set<string>();
	let current: entities.Note | null | undefined = note;
	while (current) {
		if (current.replyId != null || visited.has(current.id)) return false;
		visited.add(current.id);
		current = current.renote;
	}
	return true;
}
