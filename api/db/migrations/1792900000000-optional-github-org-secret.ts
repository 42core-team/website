import { MigrationInterface, QueryRunner } from "typeorm";

/** Events that use the GitHub App have no organizer token. */
export class OptionalGithubOrgSecret1792900000000 implements MigrationInterface {
  name = "OptionalGithubOrgSecret1792900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ALTER COLUMN "githubOrgSecret" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "events" SET "githubOrgSecret" = '' WHERE "githubOrgSecret" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ALTER COLUMN "githubOrgSecret" SET NOT NULL`,
    );
  }
}
