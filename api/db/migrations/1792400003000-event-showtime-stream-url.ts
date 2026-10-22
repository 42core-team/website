import { MigrationInterface, QueryRunner } from "typeorm";

export class EventShowtimeStreamUrl1792400003000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD "showtimeStreamUrl" varchar`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "showtimeStreamUrl"`,
    );
  }
}
