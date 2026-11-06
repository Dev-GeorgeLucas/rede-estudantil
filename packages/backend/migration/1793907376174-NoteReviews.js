/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class NoteReviews1793907376174 {
    name = 'NoteReviews1793907376174'

    /**
     * @param {QueryRunner} queryRunner
     */
    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "note_review" ("originalNoteId" character varying(32) NOT NULL, "noteId" character varying(32), "matchedWords" character varying(100) array NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "state" character varying(16) NOT NULL DEFAULT 'pending', CONSTRAINT "PK_56e181a2f0d977ea196d1958b6f" PRIMARY KEY ("originalNoteId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b833167ae4570a9ff6ab2cd818" ON "note_review"  ("state", "originalNoteId") `);
        await queryRunner.query(`ALTER TABLE "meta" ADD "reviewWords" character varying(100) array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "note_review" ADD CONSTRAINT "FK_7afffeeef2a198b243c3b9fd253" FOREIGN KEY ("noteId") REFERENCES "note"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
     * @param {QueryRunner} queryRunner
     */
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "note_review" DROP CONSTRAINT "FK_7afffeeef2a198b243c3b9fd253"`);
        await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "reviewWords"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b833167ae4570a9ff6ab2cd818"`);
        await queryRunner.query(`DROP TABLE "note_review"`);
    }
}
