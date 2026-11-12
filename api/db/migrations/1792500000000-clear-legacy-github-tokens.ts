import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * GitHub access tokens stored in the old CryptoJS format can no longer be
 * decrypted. Clear them and end those users' sessions, so they log in again
 * and their next login stores the token in the current format.
 */
export class ClearLegacyGithubTokens1792500000000 implements MigrationInterface {
  name = "ClearLegacyGithubTokens1792500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "refresh_tokens" SET "revokedAt" = now() WHERE "revokedAt" IS NULL AND "userId" IN (SELECT "id" FROM "users" WHERE "githubAccessToken" NOT LIKE 'v2:%')`,
    );
    await queryRunner.query(
      `UPDATE "users" SET "githubAccessToken" = '', "githubCheckedAt" = NULL WHERE "githubAccessToken" NOT LIKE 'v2:%' AND "githubAccessToken" <> ''`,
    );
  }

  public async down(): Promise<void> {
    // The cleared tokens cannot be restored; affected users log in again.
  }
}
