import { MigrationInterface, QueryRunner } from "typeorm";

export class MatchCoreSides1792700000000 implements MigrationInterface {
  name = "MatchCoreSides1792700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "matches" ADD "leftTeamId" uuid`);
    await queryRunner.query(`ALTER TABLE "matches" ADD "rightTeamId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "matches" ADD CONSTRAINT "FK_3a82b7c3e646dd695a6e908c427" FOREIGN KEY ("leftTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ADD CONSTRAINT "FK_66e9eae57abccd71fb85ed29d5c" FOREIGN KEY ("rightTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "matches" DROP CONSTRAINT "FK_66e9eae57abccd71fb85ed29d5c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" DROP CONSTRAINT "FK_3a82b7c3e646dd695a6e908c427"`,
    );
    await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "rightTeamId"`);
    await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "leftTeamId"`);
  }
}
