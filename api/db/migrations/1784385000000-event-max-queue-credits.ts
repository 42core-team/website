import { MigrationInterface, QueryRunner } from "typeorm";

export class EventMaxQueueCredits1784385000000 implements MigrationInterface {
  name = "EventMaxQueueCredits1784385000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD "maxQueueCredits" integer NOT NULL DEFAULT '5'`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD "queueCreditIntervalMinutes" integer NOT NULL DEFAULT '15'`,
    );
    await queryRunner.query(
      `UPDATE "teams" SET "credits" = LEAST("credits", 5)`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" ADD CONSTRAINT "CHK_teams_credits_nonnegative" CHECK ("credits" >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD CONSTRAINT "CHK_events_queue_credit_settings" CHECK ("maxQueueCredits" >= 1 AND "queueCreditIntervalMinutes" >= 1)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP CONSTRAINT "CHK_events_queue_credit_settings"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" DROP CONSTRAINT "CHK_teams_credits_nonnegative"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "queueCreditIntervalMinutes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "maxQueueCredits"`,
    );
  }
}
