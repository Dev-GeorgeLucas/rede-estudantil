/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DI } from '@/di-symbols.js';
import { MiNoteReview } from '@/models/NoteReview.js';
import { ModerationLogService } from '@/core/ModerationLogService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { RoleService } from '@/core/RoleService.js';
import Logger from '@/logger.js';

export function packNoteReview(review: MiNoteReview) {
	return {
		id: review.originalNoteId,
		noteId: review.noteId,
		createdAt: review.createdAt.toISOString(),
		matchedWords: review.matchedWords,
		state: review.state as 'pending' | 'resolved',
		resolvedById: review.resolvedById,
		resolvedAt: review.resolvedAt?.toISOString() ?? null,
		resolution: review.resolution,
	};
}

@Injectable()
export class NoteReviewService {
	private logger = new Logger('note-review');

	constructor(
		@Inject(DI.db) private db: DataSource,
		private moderationLogService: ModerationLogService,
		private roleService: RoleService,
		private globalEventService: GlobalEventService,
	) {}

	public async resolve(caseId: string, moderator: { id: string }, resolution: NonNullable<MiNoteReview['resolution']>) {
		const outcome = await this.db.transaction(async manager => {
			const repository = manager.getRepository(MiNoteReview);
			// Serialize decisions. Repeated/concurrent requests return the first decision unchanged.
			const review = await repository.findOne({ where: { originalNoteId: caseId }, lock: { mode: 'pessimistic_write' } });
			if (!review) return null;
			if (review.state !== 'pending') return { review, changed: false };
			review.state = 'resolved';
			review.resolution = resolution;
			review.resolvedById = moderator.id;
			review.resolvedAt = new Date();
			await repository.update({ originalNoteId: caseId }, { state: review.state, resolution, resolvedById: moderator.id, resolvedAt: review.resolvedAt });
			await this.moderationLogService.log(moderator, 'resolveNoteReview', {
				caseId, resolvedAt: review.resolvedAt.toISOString(), resolution,
			}, manager);
			return { review, changed: true };
		});
		if (!outcome) return null;
		if (outcome.changed) await this.notify('noteReviewResolved');
		return { ...packNoteReview(outcome.review), alreadyResolved: !outcome.changed };
	}

	public async notify(type: 'noteReviewCreated' | 'noteReviewResolved') {
		try {
			const ids = await this.roleService.getModeratorIds({ includeAdmins: true, includeRoot: true, excludeExpire: true });
			for (const id of ids) this.globalEventService.publishAdminStream(id, type, {});
		} catch {
			// Persistence has already committed. Visible clients also revalidate periodically.
			this.logger.warn('Could not invalidate note review state');
		}
	}
}
