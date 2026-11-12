import { MigrationInterface, QueryRunner } from "typeorm";

export class GithubCheckedAt1792200000000 implements MigrationInterface {
  name = "GithubCheckedAt1792200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "githubCheckedAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "githubCheckedAt"`,
    );
  }
}
