import { MigrationInterface, QueryRunner } from "typeorm";

export class StartedRepoCreationAt1769373893835 implements MigrationInterface {
    name = 'StartedRepoCreationAt1769373893835'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "teams" ADD "startedRepoCreationAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "startedRepoCreationAt"`);
    }

}
