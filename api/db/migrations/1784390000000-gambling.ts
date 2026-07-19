import { MigrationInterface, QueryRunner } from "typeorm";

export class Gambling1784390000000 implements MigrationInterface {
  name = "Gambling1784390000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "matches_phase_enum" ADD VALUE IF NOT EXISTS 'GAMBLING'`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" DROP CONSTRAINT IF EXISTS "CHK_teams_credits_nonnegative"`,
    );
    await queryRunner.query(
      `CREATE TYPE "gambling_rounds_phase_enum" AS ENUM('JOINING', 'BETTING', 'PLAYING', 'SETTLED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "gambling_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "eventId" uuid NOT NULL, "teamId" uuid NOT NULL, CONSTRAINT "UQ_gambling_entries_event_team" UNIQUE ("eventId", "teamId"), CONSTRAINT "PK_gambling_entries" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "gambling_rounds" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "phase" "gambling_rounds_phase_enum" NOT NULL, "phaseEndsAt" TIMESTAMP, "totalPool" integer NOT NULL DEFAULT '0', "winnerTeamPayout" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "eventId" uuid NOT NULL, "teamOneId" uuid, "teamTwoId" uuid, "matchId" uuid, "winnerId" uuid, CONSTRAINT "PK_gambling_rounds" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "gambling_bets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "amount" integer NOT NULL, "payout" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "roundId" uuid NOT NULL, "bettorTeamId" uuid NOT NULL, "predictedWinnerId" uuid NOT NULL, CONSTRAINT "UQ_gambling_bets_round_bettor" UNIQUE ("roundId", "bettorTeamId"), CONSTRAINT "CHK_gambling_bets_amount_positive" CHECK ("amount" > 0), CONSTRAINT "PK_gambling_bets" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "gambling_entries" ADD CONSTRAINT "FK_gambling_entries_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "gambling_entries" ADD CONSTRAINT "FK_gambling_entries_team" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "gambling_rounds" ADD CONSTRAINT "FK_gambling_rounds_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "gambling_rounds" ADD CONSTRAINT "FK_gambling_rounds_team_one" FOREIGN KEY ("teamOneId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "gambling_rounds" ADD CONSTRAINT "FK_gambling_rounds_team_two" FOREIGN KEY ("teamTwoId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "gambling_rounds" ADD CONSTRAINT "FK_gambling_rounds_match" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "gambling_rounds" ADD CONSTRAINT "FK_gambling_rounds_winner" FOREIGN KEY ("winnerId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "gambling_bets" ADD CONSTRAINT "FK_gambling_bets_round" FOREIGN KEY ("roundId") REFERENCES "gambling_rounds"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "gambling_bets" ADD CONSTRAINT "FK_gambling_bets_bettor" FOREIGN KEY ("bettorTeamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "gambling_bets" ADD CONSTRAINT "FK_gambling_bets_prediction" FOREIGN KEY ("predictedWinnerId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "gambling_bets"`);
    await queryRunner.query(`DROP TABLE "gambling_rounds"`);
    await queryRunner.query(`DROP TABLE "gambling_entries"`);
    await queryRunner.query(`DROP TYPE "gambling_rounds_phase_enum"`);
    await queryRunner.query(`DELETE FROM "matches" WHERE "phase" = 'GAMBLING'`);
    await queryRunner.query(
      `ALTER TYPE "matches_phase_enum" RENAME TO "matches_phase_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "matches_phase_enum" AS ENUM('SWISS', 'ELIMINATION', 'QUEUE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ALTER COLUMN "phase" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ALTER COLUMN "phase" TYPE "matches_phase_enum" USING "phase"::text::"matches_phase_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" ALTER COLUMN "phase" SET DEFAULT 'SWISS'`,
    );
    await queryRunner.query(`DROP TYPE "matches_phase_enum_old"`);
    await queryRunner.query(
      `UPDATE "teams" SET "credits" = GREATEST(0, "credits")`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" ADD CONSTRAINT "CHK_teams_credits_nonnegative" CHECK ("credits" >= 0)`,
    );
  }
}
