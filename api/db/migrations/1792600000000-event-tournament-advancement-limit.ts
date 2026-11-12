import { MigrationInterface, QueryRunner } from "typeorm";

export class EventTournamentAdvancementLimit1792600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD "tournamentAdvancementLimit" integer`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "tournamentAdvancementLimit"`,
    );
  }
}
