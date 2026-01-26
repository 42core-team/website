import { MigrationInterface, QueryRunner } from "typeorm";

export class RefactorEvent1761323317775 implements MigrationInterface {
    name = 'RefactorEvent1761323317775'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "areTeamsLocked"`);
        await queryRunner.query(`ALTER TABLE "events" ADD "canCreateTeam" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "events" ADD "processQueue" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "events" ADD "lockedAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "lockedAt"`);
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "processQueue"`);
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "canCreateTeam"`);
        await queryRunner.query(`ALTER TABLE "events" ADD "areTeamsLocked" boolean NOT NULL DEFAULT false`);
    }

}
