import { MigrationInterface, QueryRunner } from "typeorm";

export class SocialAccountCursusFlags1784375696042 implements MigrationInterface {
    name = 'SocialAccountCursusFlags1784375696042'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "social_accounts" ADD "isPiscineStudent" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "social_accounts" ADD "isCursusStudent" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "social_accounts" DROP COLUMN "isCursusStudent"`);
        await queryRunner.query(`ALTER TABLE "social_accounts" DROP COLUMN "isPiscineStudent"`);
    }

}
