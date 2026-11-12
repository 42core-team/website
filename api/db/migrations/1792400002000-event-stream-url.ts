import { MigrationInterface, QueryRunner } from "typeorm";

export class EventStreamUrl1792400002000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ADD "streamUrl" varchar`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "streamUrl"`);
  }
}
