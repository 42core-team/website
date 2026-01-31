import { MigrationInterface, QueryRunner } from "typeorm";

export class Serverconfig1769776121497 implements MigrationInterface {
    name = 'Serverconfig1769776121497'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" ADD "serverConfig" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "serverConfig"`);
    }

}
