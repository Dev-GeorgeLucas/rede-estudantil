/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DI } from '@/di-symbols.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { MiNoteReview } from '@/models/NoteReview.js';
import { packedNoteReviewSchema } from '@/models/json-schema/note-review.js';
import { packNoteReview } from '@/core/NoteReviewService.js';
import { QueryService } from '@/core/QueryService.js';

export const meta = {
	tags: ['admin'], requireCredential: true, requireModerator: true,
	kind: 'read:admin:abuse-user-reports',
	res: { type: 'array', optional: false, nullable: false, items: packedNoteReviewSchema },
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		caseIds: { type: 'array', minItems: 1, maxItems: 100, uniqueItems: true, items: { type: 'string', format: 'misskey:id' } },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
		state: { type: 'string', enum: ['pending', 'resolved', 'all'], default: 'pending' },
	}, required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(@Inject(DI.db) db: DataSource, queryService: QueryService) {
		super(meta, paramDef, async ps => {
			const query = queryService.makePaginationQuery(db.getRepository(MiNoteReview).createQueryBuilder('review'), ps.sinceId, ps.untilId, undefined, undefined, 'originalNoteId');
			if (ps.state !== 'all') query.andWhere('review.state = :state', { state: ps.state });
			if (ps.caseIds) query.andWhere('review.originalNoteId IN (:...caseIds)', { caseIds: ps.caseIds });
			const reviews = await query.limit(ps.limit).getMany();
			return reviews.map(packNoteReview);
		});
	}
}
