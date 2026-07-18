import { MigrationInterface, QueryRunner } from "typeorm";

export class TeamQueueCredits1784390400000 implements MigrationInterface {
  name = "TeamQueueCredits1784390400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "team_challenges_status_enum" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" ADD "credits" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" ADD "isPublic" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" ADD "lastCreditGrantedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" ADD CONSTRAINT "CHK_teams_credits_nonnegative" CHECK ("credits" >= 0)`,
    );
    await queryRunner.query(
      `CREATE TABLE "team_challenges" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" "team_challenges_status_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "respondedAt" TIMESTAMP, "challengerId" uuid NOT NULL, "targetId" uuid NOT NULL, "matchId" uuid, CONSTRAINT "CHK_team_challenge_distinct_teams" CHECK ("challengerId" <> "targetId"), CONSTRAINT "PK_team_challenges" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_team_challenges_pending_pair" ON "team_challenges" ("challengerId", "targetId") WHERE "status" = 'PENDING'`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_challenges" ADD CONSTRAINT "FK_team_challenges_challenger" FOREIGN KEY ("challengerId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_challenges" ADD CONSTRAINT "FK_team_challenges_target" FOREIGN KEY ("targetId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_challenges" ADD CONSTRAINT "FK_team_challenges_match" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "team_challenges" DROP CONSTRAINT "FK_team_challenges_match"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_challenges" DROP CONSTRAINT "FK_team_challenges_target"`,
    );
    await queryRunner.query(
      `ALTER TABLE "team_challenges" DROP CONSTRAINT "FK_team_challenges_challenger"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_team_challenges_pending_pair"`);
    await queryRunner.query(`DROP TABLE "team_challenges"`);
    await queryRunner.query(
      `ALTER TABLE "teams" DROP CONSTRAINT "CHK_teams_credits_nonnegative"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" DROP COLUMN "lastCreditGrantedAt"`,
    );
    await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "isPublic"`);
    await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "credits"`);
    await queryRunner.query(`DROP TYPE "team_challenges_status_enum"`);
  }
}
