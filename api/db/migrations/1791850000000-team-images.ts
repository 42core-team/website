import { MigrationInterface, QueryRunner } from "typeorm";
export class TeamImages1791850000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "teams" ADD "picture" jsonb, ADD "background" jsonb`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "teams" DROP COLUMN "background", DROP COLUMN "picture"`,
    );
  }
}
