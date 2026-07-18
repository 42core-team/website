import { MigrationInterface, QueryRunner } from "typeorm";

export class TeamQueueCredits1784380627920 implements MigrationInterface {
    name = 'TeamQueueCredits1784380627920'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "matches" ADD "creditWager" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "matches" ADD "creditWagerTeamId" uuid`);
        await queryRunner.query(`ALTER TABLE "teams" ADD "credits" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "teams" ADD "lastCreditGrantedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "matches" ADD CONSTRAINT "FK_532f48f0b764a6bea4801d3829d" FOREIGN KEY ("creditWagerTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "matches" DROP CONSTRAINT "FK_532f48f0b764a6bea4801d3829d"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "lastCreditGrantedAt"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "credits"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "creditWagerTeamId"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "creditWager"`);
    }

}
