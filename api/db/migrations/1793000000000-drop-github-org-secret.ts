import { MigrationInterface, QueryRunner } from "typeorm";

/** Events only reach GitHub through the CORE GitHub App; organizer tokens are gone. */
export class DropGithubOrgSecret1793000000000 implements MigrationInterface {
  name = "DropGithubOrgSecret1793000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "githubOrgSecret"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD "githubOrgSecret" character varying`,
    );
  }
}
