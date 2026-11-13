import { MigrationInterface, QueryRunner } from "typeorm";

export class MonorepoVersion1758053882931 implements MigrationInterface {
  name = "MonorepoVersion1758053882931";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "repoTemplateName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "repoTemplateOwner"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD "monorepoVersion" character varying DEFAULT 'dev'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "monorepoVersion"`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD "repoTemplateOwner" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD "repoTemplateName" character varying`,
    );
  }
}
