/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { MiNote } from './Note.js';
import { id } from './util/id.js';

@Entity('note_review')
@Index(['state', 'originalNoteId'])
export class MiNoteReview {
	@PrimaryColumn(id())
	public originalNoteId: string;

	@Column({ ...id(), nullable: true })
	public noteId: string | null;

	@ManyToOne(() => MiNote, { onDelete: 'SET NULL' })
	@JoinColumn()
	public note: MiNote | null;

	@Column('varchar', { length: 100, array: true })
	public matchedWords: string[];

	@Column('timestamp with time zone', { default: () => 'CURRENT_TIMESTAMP' })
	public createdAt: Date;

	@Column('varchar', { length: 16, default: 'pending' })
	public state: string;
}
