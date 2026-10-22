import { MigrationInterface, QueryRunner } from "typeorm";

export class ManualMatches1792000000000 implements MigrationInterface {
  name = "ManualMatches1792000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "matches_phase_enum" ADD VALUE IF NOT EXISTS 'MANUAL'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "matches" WHERE "phase" = 'MANUAL'`);
    await queryRunner.query(
      `ALTER TYPE "matches_phase_enum" RENAME TO "matches_phase_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "matches_phase_enum" AS ENUM('SWISS', 'ELIMINATION', 'QUEUE', 'GAMBLING')`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ALTER COLUMN "phase" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ALTER COLUMN "phase" TYPE "matches_phase_enum" USING "phase"::text::"matches_phase_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ALTER COLUMN "phase" SET DEFAULT 'SWISS'`,
    );
    await queryRunner.query(`DROP TYPE "matches_phase_enum_old"`);
  }
}
