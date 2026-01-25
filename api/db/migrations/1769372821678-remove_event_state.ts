import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveEventState1769372821678 implements MigrationInterface {
    name = 'RemoveEventState1769372821678'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "state"`);
        await queryRunner.query(`DROP TYPE "public"."events_state_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."events_state_enum" AS ENUM('TEAM_FINDING', 'CODING_PHASE', 'SWISS_ROUND', 'ELIMINATION_ROUND', 'FINISHED')`);
        await queryRunner.query(`ALTER TABLE "events" ADD "state" "public"."events_state_enum" NOT NULL DEFAULT 'CODING_PHASE'`);
    }

}
