import { MigrationInterface, QueryRunner } from "typeorm";

/** Lets the API restart matches whose game Job never reported a result. */
export class MatchStartAttempts1793300000000 implements MigrationInterface {
  name = "MatchStartAttempts1793300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "matches" ADD "startAttempts" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ADD "startedAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "startedAt"`);
    await queryRunner.query(
      `ALTER TABLE "matches" DROP COLUMN "startAttempts"`,
    );
  }
}
