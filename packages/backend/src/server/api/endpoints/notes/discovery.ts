/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { FollowingsRepository, NotesRepository, UserProfilesRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { QueryService } from '@/core/QueryService.js';
import { DI } from '@/di-symbols.js';
import { checkWordMute } from '@/misc/check-word-mute.js';
import { collectDiscoveryNotes, DiscoveryScanLimitError } from '@/misc/collect-discovery-notes.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['notes'],
	requireCredential: true,
	kind: 'read:account',
	limit: { duration: 60000, max: 120 },
	res: {
		type: 'array', optional: false, nullable: false,
		items: { type: 'object', optional: false, nullable: false, ref: 'Note' },
	},
	errors: {
		scanLimitExceeded: {
			message: 'Too many muted discovery candidates. Please refine your mute filters.',
			code: 'DISCOVERY_SCAN_LIMIT_EXCEEDED',
			id: '60d60486-b453-4f83-83db-d502332ecf45',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,
		@Inject(DI.followingsRepository)
		private followingsRepository: FollowingsRepository,
		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,
		private queryService: QueryService,
		private noteEntityService: NoteEntityService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const following = this.followingsRepository.createQueryBuilder('following')
				.select('1')
				.where('following.followerId = :discoveryUserId')
				.andWhere('following.followeeId = note.userId');

			const eligibleQuery = () => {
				const query = this.notesRepository.createQueryBuilder('note')
					.innerJoinAndSelect('note.user', 'user')
					.leftJoinAndSelect('note.reply', 'reply')
					.leftJoinAndSelect('note.renote', 'renote')
					.leftJoinAndSelect('reply.user', 'replyUser')
					.leftJoinAndSelect('renote.user', 'renoteUser')
					.where('note.visibility = :discoveryVisibility', { discoveryVisibility: 'public' })
					.andWhere('note.userHost IS NULL AND user.host IS NULL')
					.andWhere('user.isDeleted = FALSE')
					.andWhere('note.userId != :discoveryUserId', { discoveryUserId: me.id })
					.andWhere(`NOT EXISTS (${following.getQuery()})`)
					// Communities have their own discovery and access/muting rules.
					.andWhere('note.channelId IS NULL')
					.andWhere('note.replyId IS NULL');
				this.queryService.generateVisibilityQuery(query, me);
				this.queryService.generateBaseNoteFilteringQuery(query, me);
				this.queryService.generateBlockQueryForUsers(query, me);
				this.queryService.generateMutedNoteThreadQuery(query, me);
				this.queryService.generateMutedUserRenotesQueryForNotes(query, me);
				return query;
			};

			// Only embed an eligible original. Nested quotes/replies are intentionally
			// excluded so packing cannot traverse to unverified remote/private content.
			const original = eligibleQuery().andWhere('note.renoteId IS NULL').select('note.id');
			const query = eligibleQuery()
				.andWhere(`(note.renoteId IS NULL OR note.renoteId IN (${original.getQuery()}))`)
				.setParameters(original.getParameters());
			const profile = await this.userProfilesRepository.findOneByOrFail({ userId: me.id });
			const newer = ps.sinceId != null && ps.untilId == null;

			try {
				const notes = await collectDiscoveryNotes(async (cursor, limit) => {
					return await this.queryService.makePaginationQuery(query.clone(),
						newer ? cursor ?? ps.sinceId : ps.sinceId,
						newer ? undefined : cursor ?? ps.untilId,
					).limit(limit).getMany();
				}, async note => {
					if (await checkWordMute(note, me, profile.hardMutedWords)) return false;
					if (note.renote && await checkWordMute(note.renote, me, profile.hardMutedWords)) return false;
					return true;
				}, ps.limit);
				return await this.noteEntityService.packMany(notes, me);
			} catch (err) {
				if (err instanceof DiscoveryScanLimitError) throw new ApiError(meta.errors.scanLimitExceeded);
				throw err;
			}
		});
	}
}
