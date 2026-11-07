/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { ApiError } from '@/server/api/error.js';
import { NoteReviewService } from '@/core/NoteReviewService.js';
import { packedNoteReviewSchema } from '@/models/json-schema/note-review.js';

export const meta = {
	tags: ['admin'], requireCredential: true, requireModerator: true,
	kind: 'write:admin:resolve-abuse-user-report',
	errors: {
		noSuchCase: { message: 'No such note review.', code: 'NO_SUCH_NOTE_REVIEW', id: '8786851b-62c1-4f62-bae8-0fd1ece7a701', kind: 'server', httpStatusCode: 404 },
	},
	res: {
		...packedNoteReviewSchema,
		properties: { ...packedNoteReviewSchema.properties, alreadyResolved: { type: 'boolean', optional: false, nullable: false } },
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		caseId: { type: 'string', format: 'misskey:id' },
		resolution: { type: 'string', enum: ['falsePositive', 'reviewed', 'unavailable'] },
	}, required: ['caseId', 'resolution'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(service: NoteReviewService) {
		super(meta, paramDef, async (ps, me) => {
			const result = await service.resolve(ps.caseId, me, ps.resolution);
			if (!result) throw new ApiError(meta.errors.noSuchCase);
			return result;
		});
	}
}
