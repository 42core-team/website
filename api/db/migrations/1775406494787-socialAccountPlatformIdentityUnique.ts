import { MigrationInterface, QueryRunner } from "typeorm";

export class SocialAccountPlatformIdentityUnique1775406494787 implements MigrationInterface {
    name = 'SocialAccountPlatformIdentityUnique1775406494787'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "social_accounts" ADD CONSTRAINT "UQ_social_accounts_platform_platform_user_id" UNIQUE ("platform", "platformUserId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "social_accounts" DROP CONSTRAINT "UQ_social_accounts_platform_platform_user_id"`);
    }

}
