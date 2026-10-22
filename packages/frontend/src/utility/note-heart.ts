/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const HEART_REACTION = '\u2764';

export function isHeartReaction(reaction: string | null | undefined): boolean {
	return reaction?.replace(/\ufe0f/g, '') === HEART_REACTION;
}

export function heartCount(reactions: Record<string, number>): number {
	return Object.entries(reactions).reduce((total, [reaction, count]) => total + (isHeartReaction(reaction) ? count : 0), 0);
}

// Shared by every rendered copy of a note; entries live only for the operation.
const pending = new Set<string>();

export async function toggleNoteReaction(id: string, actions: {
	current: () => string | null | undefined;
	confirm: () => Promise<boolean>;
	create: () => Promise<unknown>;
	remove: () => Promise<unknown>;
	reconcile: () => Promise<unknown>;
}, reaction = HEART_REACTION): Promise<void> {
	const normalize = (value: string | null | undefined) => value?.replace(/^:(\w+):$/, ':$1@.:').replace(/\ufe0f/g, '');
	const matches = (value: string | null | undefined) => normalize(value) === normalize(reaction);
	if (pending.has(id)) return;
	pending.add(id);
	try {
		const previous = actions.current();
		if (previous && !matches(previous) && !await actions.confirm()) return;
		// The existing create endpoint replaces a different reaction itself.
		// Do not delete the previous reaction on the client before creating.
		try {
			if (matches(actions.current())) await actions.remove();
			else await actions.create();
		} finally {
			// Read authoritative state even after a timeout or partial server failure.
			await actions.reconcile();
		}
	} finally {
		pending.delete(id);
	}
}

export const toggleNoteHeart = toggleNoteReaction;
