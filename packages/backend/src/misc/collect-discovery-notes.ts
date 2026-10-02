/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/** A bounded scan must never report exhaustion just because a batch was muted. */
export class DiscoveryScanLimitError extends Error {}

export async function collectDiscoveryNotes<T extends { id: string }>(
	fetch: (cursor: string | undefined, limit: number) => Promise<T[]>,
	accept: (note: T) => Promise<boolean>,
	limit: number,
	maxCandidates = 1000,
): Promise<T[]> {
	const result: T[] = [];
	let cursor: string | undefined;
	let scanned = 0;
	while (scanned < maxCandidates) {
		const batchSize = Math.min(100, maxCandidates - scanned);
		const candidates = await fetch(cursor, batchSize);
		for (const note of candidates) {
			scanned++;
			if (await accept(note)) result.push(note);
			if (result.length === limit) return result;
		}
		if (candidates.length < batchSize) return result;
		cursor = candidates[candidates.length - 1].id;
	}
	// A nonempty partial page has a usable untilId/sinceId. An empty one does not.
	if (result.length > 0) return result;
	throw new DiscoveryScanLimitError();
}
