import { MigrationInterface, QueryRunner } from "typeorm";

export class TeamRepositoryStatus1792400001000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "teams"
      ADD "repositoryStatus" varchar NOT NULL DEFAULT 'PENDING',
      ADD "repositoryOperationId" uuid,
      ADD "repositoryError" text,
      ADD "tournamentExcluded" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`UPDATE "teams" SET "repositoryStatus" =
      CASE WHEN "repo" IS NULL OR "repo" = '' THEN 'PENDING'
      WHEN "locked" THEN 'LOCKED' ELSE 'READY' END`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "teams" DROP "repositoryStatus",
      DROP "repositoryOperationId", DROP "repositoryError", DROP "tournamentExcluded"`);
  }
}
