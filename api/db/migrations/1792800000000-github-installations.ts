import { MigrationInterface, QueryRunner } from "typeorm";

export class GithubInstallations1792800000000 implements MigrationInterface {
  name = "GithubInstallations1792800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "github_installations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "installationId" bigint NOT NULL, "accountId" bigint NOT NULL, "accountLogin" character varying NOT NULL, "accountType" character varying NOT NULL, "suspendedAt" TIMESTAMP WITH TIME ZONE, "deletedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_github_installations_installation_id" UNIQUE ("installationId"), CONSTRAINT "PK_github_installations" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD "githubInstallationId" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_events_github_installation_id" ON "events" ("githubInstallationId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD CONSTRAINT "FK_events_github_installation" FOREIGN KEY ("githubInstallationId") REFERENCES "github_installations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" DROP CONSTRAINT "FK_events_github_installation"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_events_github_installation_id"`);
    await queryRunner.query(
      `ALTER TABLE "events" DROP COLUMN "githubInstallationId"`,
    );
    await queryRunner.query(`DROP TABLE "github_installations"`);
  }
}
