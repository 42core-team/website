import { MigrationInterface, QueryRunner } from "typeorm";

export class TeamCustomizations1784395000000 implements MigrationInterface {
  name = "TeamCustomizations1784395000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "teams" ADD "description" text`);
    await queryRunner.query(`ALTER TABLE "teams" ADD "profileImageUrl" text`);
    await queryRunner.query(`ALTER TABLE "teams" ADD "bannerImageUrl" text`);
    await queryRunner.query(`ALTER TABLE "teams" ADD "winningSoundUrl" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "teams" DROP COLUMN "winningSoundUrl"`,
    );
    await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "bannerImageUrl"`);
    await queryRunner.query(
      `ALTER TABLE "teams" DROP COLUMN "profileImageUrl"`,
    );
    await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "description"`);
  }
}
