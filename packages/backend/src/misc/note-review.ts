/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { MiNote } from '@/models/Note.js';
import { MiNoteReview } from '@/models/NoteReview.js';
import type { EntityManager } from 'typeorm';

export const MAX_REVIEW_WORDS = 100;
export const MAX_REVIEW_WORD_LENGTH = 100;

export function normalizeReviewText(value: string): string {
	return value.normalize('NFKC').toLowerCase().normalize('NFKC');
}

export function normalizeReviewWords(values: string[]): string[] {
	if (values.length > MAX_REVIEW_WORDS) throw new RangeError('Too many review words');
	const result: string[] = [];
	const equivalents: RegExp[] = [];
	for (const value of values) {
		const word = normalizeReviewText(value).trim();
		if (!word) continue;
		if (Array.from(word).length > MAX_REVIEW_WORD_LENGTH || /[\p{Cc}\p{Cf}*?]/u.test(word) || /^\/.*\/[a-z]*$/u.test(word)) {
			throw new RangeError('Invalid literal review word');
		}
		if (!equivalents.some(pattern => pattern.test(word))) {
			result.push(word);
			equivalents.push(new RegExp(`^${escapeLiteral(word)}$`, 'iu'));
		}
	}
	return result;
}

function escapeLiteral(word: string): string {
	return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchedReviewWords(
	note: Pick<MiNote, 'userHost' | 'visibility' | 'text' | 'cw'>,
	words: readonly string[],
	pollChoices?: readonly string[],
): string[] {
	// Never inspect content from an ineligible note, or run the comparator when disabled.
	if (note.userHost !== null || note.visibility !== 'public' || words.length === 0) return [];
	const fields = [note.text, note.cw, ...(pollChoices ?? [])]
		.filter((field): field is string => typeof field === 'string' && field.length > 0)
		.map(normalizeReviewText);
	return [...new Set(words)].filter(word => {
		const literal = escapeLiteral(word);
		// Unicode letters, marks, numbers and underscore belong to the same word.
		const pattern = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])${literal}(?![\\p{L}\\p{M}\\p{N}_])`, 'iu');
		return fields.some(field => pattern.test(field));
	});
}

// The caller must use the same transaction manager that inserts the note/poll.
// DO NOTHING preserves both the initial evidence and any future review decision.
export async function insertNoteReview(manager: EntityManager, noteId: string, words: string[]): Promise<void> {
	if (words.length === 0) return;
	try {
		await manager.createQueryBuilder().insert().into(MiNoteReview).values({
			originalNoteId: noteId,
			noteId,
			matchedWords: [...new Set(words)],
		}).orIgnore(true).execute();
	} catch {
		// Driver errors may include SQL parameters containing the private rule list.
		// Keep the failure fatal to the transaction without logging those parameters.
		throw new Error('Failed to persist note review');
	}
}
