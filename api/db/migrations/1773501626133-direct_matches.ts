import { MigrationInterface, QueryRunner } from "typeorm";

export class DirectMatches1773501626133 implements MigrationInterface {
    name = 'DirectMatches1773501626133'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "teams" ADD "allowChallenges" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "allowChallenges"`);
    }

}
