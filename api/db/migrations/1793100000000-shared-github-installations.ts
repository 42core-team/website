import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A global admin can share an installation, so any event creator may link it
 * without being an owner of its organization.
 */
export class SharedGithubInstallations1793100000000 implements MigrationInterface {
  name = "SharedGithubInstallations1793100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "github_installations" ADD "sharedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "github_installations" ADD "sharedById" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "github_installations" ADD CONSTRAINT "FK_github_installations_shared_by" FOREIGN KEY ("sharedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "github_installations" DROP CONSTRAINT "FK_github_installations_shared_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "github_installations" DROP COLUMN "sharedById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "github_installations" DROP COLUMN "sharedAt"`,
    );
  }
}
