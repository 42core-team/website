import { MigrationInterface, QueryRunner } from "typeorm";

export class SocialAccountPlatformIdentityUnique1775385600000
  implements MigrationInterface
{
  name = "SocialAccountPlatformIdentityUnique1775385600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH ranked_social_accounts AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY "platform", "platformUserId"
            ORDER BY "createdAt" ASC, id ASC
          ) AS row_number
        FROM "social_accounts"
      )
      DELETE FROM "social_accounts"
      WHERE id IN (
        SELECT id
        FROM ranked_social_accounts
        WHERE row_number > 1
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "social_accounts"
      ADD CONSTRAINT "UQ_social_accounts_platform_platform_user_id"
      UNIQUE ("platform", "platformUserId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "social_accounts"
      DROP CONSTRAINT "UQ_social_accounts_platform_platform_user_id"
    `);
  }
}
