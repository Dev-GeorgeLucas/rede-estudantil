/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const packedNoteReviewSchema = {
	type: 'object', optional: false, nullable: false,
	properties: {
		id: { type: 'string', format: 'id', optional: false, nullable: false },
		noteId: { type: 'string', format: 'id', optional: false, nullable: true },
		createdAt: { type: 'string', format: 'date-time', optional: false, nullable: false },
		matchedWords: { type: 'array', items: { type: 'string' }, optional: false, nullable: false },
		state: { type: 'string', enum: ['pending', 'resolved'], optional: false, nullable: false },
		resolvedById: { type: 'string', format: 'id', optional: false, nullable: true },
		resolvedAt: { type: 'string', format: 'date-time', optional: false, nullable: true },
		resolution: { type: 'string', enum: ['falsePositive', 'reviewed', 'unavailable', null], optional: false, nullable: true },
	},
} as const;
