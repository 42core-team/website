import { MigrationInterface, QueryRunner } from "typeorm";

export class Configvisibility1769784644202 implements MigrationInterface {
    name = 'Configvisibility1769784644202'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" ADD "showConfigs" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "showConfigs"`);
    }

}
