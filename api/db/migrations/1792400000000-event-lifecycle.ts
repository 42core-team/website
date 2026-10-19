import { MigrationInterface, QueryRunner } from "typeorm";

export class EventLifecycle1792400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."events_state_enum" AS ENUM ('REGISTRATION', 'PLAYING', 'SUBMISSIONS_CLOSED', 'SHOWCASE', 'COMPLETED')`,
    );
    await queryRunner.query(`ALTER TABLE "events"
      ADD "state" "public"."events_state_enum" NOT NULL DEFAULT 'REGISTRATION',
      ADD "submissionDeadline" timestamp,
      ADD "scheduledEndDate" timestamp,
      ADD "completedAt" timestamp,
      ADD "introEnabled" boolean NOT NULL DEFAULT false,
      ADD "introLeadMinutes" integer NOT NULL DEFAULT 15`);
    await queryRunner.query(`UPDATE "events" SET
      "submissionDeadline" = COALESCE("repoLockDate", "endDate"),
      "scheduledEndDate" = "endDate",
      "completedAt" = CASE WHEN "endDate" <= CURRENT_TIMESTAMP THEN "endDate" ELSE NULL END,
      "state" = (CASE
        WHEN "endDate" <= CURRENT_TIMESTAMP THEN 'COMPLETED'
        WHEN "lockedAt" IS NOT NULL OR COALESCE("repoLockDate", "endDate") <= CURRENT_TIMESTAMP THEN 'SUBMISSIONS_CLOSED'
        WHEN "startDate" <= CURRENT_TIMESTAMP THEN 'PLAYING'
        ELSE 'REGISTRATION' END)::"public"."events_state_enum"`);
    await queryRunner.query(
      `UPDATE "events" SET "repoLockDate" = "submissionDeadline"`,
    );
    await queryRunner.query(
      `UPDATE "events" SET "canCreateTeam" = false, "processQueue" = false WHERE "state" IN ('SUBMISSIONS_CLOSED', 'COMPLETED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ALTER COLUMN "submissionDeadline" SET NOT NULL, ALTER COLUMN "scheduledEndDate" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "state", DROP COLUMN "submissionDeadline", DROP COLUMN "scheduledEndDate", DROP COLUMN "completedAt", DROP COLUMN "introEnabled", DROP COLUMN "introLeadMinutes"`,
    );
    await queryRunner.query(`DROP TYPE "public"."events_state_enum"`);
  }
}
