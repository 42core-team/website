import { MigrationInterface, QueryRunner } from "typeorm";

export class EventAudience1784375696043 implements MigrationInterface {
    name = 'EventAudience1784375696043'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" ADD "audience" text NOT NULL DEFAULT 'BOTH'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "audience"`);
    }

}
