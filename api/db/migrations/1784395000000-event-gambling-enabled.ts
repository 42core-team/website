import { MigrationInterface, QueryRunner } from "typeorm";

export class EventGamblingEnabled1784395000000 implements MigrationInterface {
  name = "EventGamblingEnabled1784395000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD "gamblingEnabled" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "gamblingEnabled"`,
    );
  }
}
