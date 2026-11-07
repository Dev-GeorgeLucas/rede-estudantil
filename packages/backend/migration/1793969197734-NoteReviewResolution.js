/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class NoteReviewResolution1793969197734 {
    name = 'NoteReviewResolution1793969197734'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "note_review" ADD "resolvedById" character varying(32)`);
        await queryRunner.query(`ALTER TABLE "note_review" ADD "resolvedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "note_review" ADD "resolution" character varying(32)`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "note_review" DROP COLUMN "resolution"`);
        await queryRunner.query(`ALTER TABLE "note_review" DROP COLUMN "resolvedAt"`);
        await queryRunner.query(`ALTER TABLE "note_review" DROP COLUMN "resolvedById"`);
    }
}
