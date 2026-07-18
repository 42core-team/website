import { MigrationInterface, QueryRunner } from "typeorm";

export class TeamQueueCredits1784375575357 implements MigrationInterface {
  name = "TeamQueueCredits1784375575357";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "teams" ADD "credits" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" ADD "lastCreditGrantedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" ADD CONSTRAINT "CHK_teams_credits_nonnegative" CHECK ("credits" >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ADD "creditWager" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ADD "creditWagerTeamId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ADD CONSTRAINT "CHK_matches_credit_wager_nonnegative" CHECK ("creditWager" >= 0)`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ADD CONSTRAINT "FK_matches_credit_wager_team" FOREIGN KEY ("creditWagerTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "matches" DROP CONSTRAINT "FK_matches_credit_wager_team"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" DROP CONSTRAINT "CHK_matches_credit_wager_nonnegative"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" DROP COLUMN "creditWagerTeamId"`,
    );
    await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "creditWager"`);
    await queryRunner.query(
      `ALTER TABLE "teams" DROP CONSTRAINT "CHK_teams_credits_nonnegative"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" DROP COLUMN "lastCreditGrantedAt"`,
    );
    await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "credits"`);
  }
}
