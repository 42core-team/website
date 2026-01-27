import { MigrationInterface, QueryRunner } from "typeorm";

export class GameConfigAndBasePath1768163770386 implements MigrationInterface {
    name = 'GameConfigAndBasePath1768163770386'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" ADD "basePath" character varying NOT NULL DEFAULT 'my-core-bot'`);
        await queryRunner.query(`ALTER TABLE "events" ADD "gameConfig" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "gameConfig"`);
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "basePath"`);
    }

}
