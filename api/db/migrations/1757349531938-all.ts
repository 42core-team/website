import { MigrationInterface, QueryRunner } from "typeorm";

export class All1757349531938 implements MigrationInterface {
    name = 'All1757349531938'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "match_team_results" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "score" integer NOT NULL, "teamId" uuid, "matchId" uuid, CONSTRAINT "PK_be5ffbdb0edb485abb55484537a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "match_stats" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actionsExecuted" integer NOT NULL DEFAULT '0', "damageDeposits" integer NOT NULL DEFAULT '0', "gempilesDestroyed" integer NOT NULL DEFAULT '0', "damageTotal" integer NOT NULL DEFAULT '0', "damageSelf" integer NOT NULL DEFAULT '0', "damageOpponent" integer NOT NULL DEFAULT '0', "damageUnits" integer NOT NULL DEFAULT '0', "damageCores" integer NOT NULL DEFAULT '0', "damageWalls" integer NOT NULL DEFAULT '0', "unitsSpawned" integer NOT NULL DEFAULT '0', "unitsDestroyed" integer NOT NULL DEFAULT '0', "coresDestroyed" integer NOT NULL DEFAULT '0', "wallsDestroyed" integer NOT NULL DEFAULT '0', "gemsTransferred" integer NOT NULL DEFAULT '0', "tilesTraveled" integer NOT NULL DEFAULT '0', "gemsGained" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "matchId" uuid, CONSTRAINT "REL_0df1689a5c668e461dea2435da" UNIQUE ("matchId"), CONSTRAINT "PK_c773744b8dae4efbbf72d4b486c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "matches_state_enum" AS ENUM('PLANNED', 'IN_PROGRESS', 'FINISHED')`);
        await queryRunner.query(`CREATE TYPE "matches_phase_enum" AS ENUM('SWISS', 'ELIMINATION', 'QUEUE')`);
        await queryRunner.query(`CREATE TABLE "matches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "state" "matches_state_enum" NOT NULL, "round" integer NOT NULL, "phase" "matches_phase_enum" NOT NULL DEFAULT 'SWISS', "isRevealed" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "winnerId" uuid, CONSTRAINT "PK_8a22c7b2e0828988d51256117f4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "teams" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "locked" boolean NOT NULL DEFAULT false, "repo" character varying, "score" integer NOT NULL DEFAULT '0', "buchholzPoints" integer NOT NULL DEFAULT '0', "queueScore" integer NOT NULL DEFAULT '1000', "inQueue" boolean NOT NULL DEFAULT false, "hadBye" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "eventId" uuid, CONSTRAINT "PK_7e5523774a38b08a6236d322403" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "events_state_enum" AS ENUM('TEAM_FINDING', 'CODING_PHASE', 'SWISS_ROUND', 'ELIMINATION_ROUND', 'FINISHED')`);
        await queryRunner.query(`CREATE TABLE "events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying NOT NULL DEFAULT '', "githubOrg" character varying NOT NULL, "githubOrgSecret" character varying NOT NULL, "repoTemplateOwner" character varying, "repoTemplateName" character varying, "location" character varying NOT NULL DEFAULT '', "minTeamSize" integer NOT NULL, "maxTeamSize" integer NOT NULL, "startDate" TIMESTAMP NOT NULL, "endDate" TIMESTAMP NOT NULL, "repoLockDate" TIMESTAMP, "areTeamsLocked" boolean NOT NULL DEFAULT false, "state" "events_state_enum" NOT NULL DEFAULT 'TEAM_FINDING', "currentRound" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "gameServerDockerImage" character varying, "myCoreBotDockerImage" character varying, "visualizerDockerImage" character varying, "monorepoUrl" character varying, CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "social_accounts_platform_enum" AS ENUM('42')`);
        await queryRunner.query(`CREATE TABLE "social_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "platform" "social_accounts_platform_enum" NOT NULL, "username" character varying NOT NULL, "platformUserId" character varying NOT NULL, "userId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_b1badba55d4169ae69f2a43ba8c" UNIQUE ("userId", "platform"), CONSTRAINT "PK_e9e58d2d8e9fafa20af914d9750" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "githubId" character varying NOT NULL, "githubAccessToken" character varying NOT NULL, "email" character varying NOT NULL, "username" character varying NOT NULL, "name" character varying NOT NULL, "profilePicture" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "canCreateEvent" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "user_event_permissions_role_enum" AS ENUM('USER', 'ADMIN')`);
        await queryRunner.query(`CREATE TABLE "user_event_permissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "role" "user_event_permissions_role_enum" NOT NULL DEFAULT 'USER', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, "eventId" uuid, CONSTRAINT "PK_70ceb6ae37a0e7a80034e63594d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "matches_teams" ("matchesId" uuid NOT NULL, "teamsId" uuid NOT NULL, CONSTRAINT "PK_36ace1702ab545be7ba5bab63e2" PRIMARY KEY ("matchesId", "teamsId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5158327e24c6e29e9d2144d0b9" ON "matches_teams" ("matchesId") `);
        await queryRunner.query(`CREATE INDEX "IDX_200c5a21dd735d2f334bbb0aba" ON "matches_teams" ("teamsId") `);
        await queryRunner.query(`CREATE TABLE "teams_users" ("teamsId" uuid NOT NULL, "usersId" uuid NOT NULL, CONSTRAINT "PK_961ac69159467aaabfcd702c2ab" PRIMARY KEY ("teamsId", "usersId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_083b899d60a19c4fd682fc5db3" ON "teams_users" ("teamsId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0e26a42aaf7fa4086e423694e4" ON "teams_users" ("usersId") `);
        await queryRunner.query(`CREATE TABLE "teams_invites_users" ("teamsId" uuid NOT NULL, "usersId" uuid NOT NULL, CONSTRAINT "PK_f3be81b71190b697f5b1359456e" PRIMARY KEY ("teamsId", "usersId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_26b95583e861674f5a5631b3f5" ON "teams_invites_users" ("teamsId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9898d19dbe2b91604456d7a55f" ON "teams_invites_users" ("usersId") `);
        await queryRunner.query(`CREATE TABLE "events_users" ("eventsId" uuid NOT NULL, "usersId" uuid NOT NULL, CONSTRAINT "PK_45fc40a9656b63fffcbe1256604" PRIMARY KEY ("eventsId", "usersId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1be1fcf23efa4587e59aeea250" ON "events_users" ("eventsId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a8ec0c8bb2d204ad78348fea1e" ON "events_users" ("usersId") `);
        await queryRunner.query(`ALTER TABLE "match_team_results" ADD CONSTRAINT "FK_b5337e3049fcdbbaa1aac36c6f8" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "match_team_results" ADD CONSTRAINT "FK_e4092355d22de28b237b278df57" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "match_stats" ADD CONSTRAINT "FK_0df1689a5c668e461dea2435dae" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "matches" ADD CONSTRAINT "FK_eb5e9984be5b3bd5c8e3ef2d9ec" FOREIGN KEY ("winnerId") REFERENCES "teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams" ADD CONSTRAINT "FK_f01dc07b27e3edecf109d539cd1" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "social_accounts" ADD CONSTRAINT "FK_7de933c3670ec71c68aca0afd56" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_event_permissions" ADD CONSTRAINT "FK_e189e82ce2e91fb825dba7a78a6" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_event_permissions" ADD CONSTRAINT "FK_be10180bb75847f4c41e5057fed" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "matches_teams" ADD CONSTRAINT "FK_5158327e24c6e29e9d2144d0b9b" FOREIGN KEY ("matchesId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "matches_teams" ADD CONSTRAINT "FK_200c5a21dd735d2f334bbb0aba3" FOREIGN KEY ("teamsId") REFERENCES "teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams_users" ADD CONSTRAINT "FK_083b899d60a19c4fd682fc5db37" FOREIGN KEY ("teamsId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "teams_users" ADD CONSTRAINT "FK_0e26a42aaf7fa4086e423694e4c" FOREIGN KEY ("usersId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "teams_invites_users" ADD CONSTRAINT "FK_26b95583e861674f5a5631b3f5d" FOREIGN KEY ("teamsId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "teams_invites_users" ADD CONSTRAINT "FK_9898d19dbe2b91604456d7a55f2" FOREIGN KEY ("usersId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "events_users" ADD CONSTRAINT "FK_1be1fcf23efa4587e59aeea2508" FOREIGN KEY ("eventsId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "events_users" ADD CONSTRAINT "FK_a8ec0c8bb2d204ad78348fea1e1" FOREIGN KEY ("usersId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "events_users" DROP CONSTRAINT "FK_a8ec0c8bb2d204ad78348fea1e1"`);
        await queryRunner.query(`ALTER TABLE "events_users" DROP CONSTRAINT "FK_1be1fcf23efa4587e59aeea2508"`);
        await queryRunner.query(`ALTER TABLE "teams_invites_users" DROP CONSTRAINT "FK_9898d19dbe2b91604456d7a55f2"`);
        await queryRunner.query(`ALTER TABLE "teams_invites_users" DROP CONSTRAINT "FK_26b95583e861674f5a5631b3f5d"`);
        await queryRunner.query(`ALTER TABLE "teams_users" DROP CONSTRAINT "FK_0e26a42aaf7fa4086e423694e4c"`);
        await queryRunner.query(`ALTER TABLE "teams_users" DROP CONSTRAINT "FK_083b899d60a19c4fd682fc5db37"`);
        await queryRunner.query(`ALTER TABLE "matches_teams" DROP CONSTRAINT "FK_200c5a21dd735d2f334bbb0aba3"`);
        await queryRunner.query(`ALTER TABLE "matches_teams" DROP CONSTRAINT "FK_5158327e24c6e29e9d2144d0b9b"`);
        await queryRunner.query(`ALTER TABLE "user_event_permissions" DROP CONSTRAINT "FK_be10180bb75847f4c41e5057fed"`);
        await queryRunner.query(`ALTER TABLE "user_event_permissions" DROP CONSTRAINT "FK_e189e82ce2e91fb825dba7a78a6"`);
        await queryRunner.query(`ALTER TABLE "social_accounts" DROP CONSTRAINT "FK_7de933c3670ec71c68aca0afd56"`);
        await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_f01dc07b27e3edecf109d539cd1"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP CONSTRAINT "FK_eb5e9984be5b3bd5c8e3ef2d9ec"`);
        await queryRunner.query(`ALTER TABLE "match_stats" DROP CONSTRAINT "FK_0df1689a5c668e461dea2435dae"`);
        await queryRunner.query(`ALTER TABLE "match_team_results" DROP CONSTRAINT "FK_e4092355d22de28b237b278df57"`);
        await queryRunner.query(`ALTER TABLE "match_team_results" DROP CONSTRAINT "FK_b5337e3049fcdbbaa1aac36c6f8"`);
        await queryRunner.query(`DROP INDEX "IDX_a8ec0c8bb2d204ad78348fea1e"`);
        await queryRunner.query(`DROP INDEX "IDX_1be1fcf23efa4587e59aeea250"`);
        await queryRunner.query(`DROP TABLE "events_users"`);
        await queryRunner.query(`DROP INDEX "IDX_9898d19dbe2b91604456d7a55f"`);
        await queryRunner.query(`DROP INDEX "IDX_26b95583e861674f5a5631b3f5"`);
        await queryRunner.query(`DROP TABLE "teams_invites_users"`);
        await queryRunner.query(`DROP INDEX "IDX_0e26a42aaf7fa4086e423694e4"`);
        await queryRunner.query(`DROP INDEX "IDX_083b899d60a19c4fd682fc5db3"`);
        await queryRunner.query(`DROP TABLE "teams_users"`);
        await queryRunner.query(`DROP INDEX "IDX_200c5a21dd735d2f334bbb0aba"`);
        await queryRunner.query(`DROP INDEX "IDX_5158327e24c6e29e9d2144d0b9"`);
        await queryRunner.query(`DROP TABLE "matches_teams"`);
        await queryRunner.query(`DROP TABLE "user_event_permissions"`);
        await queryRunner.query(`DROP TYPE "user_event_permissions_role_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "social_accounts"`);
        await queryRunner.query(`DROP TYPE "social_accounts_platform_enum"`);
        await queryRunner.query(`DROP TABLE "events"`);
        await queryRunner.query(`DROP TYPE "events_state_enum"`);
        await queryRunner.query(`DROP TABLE "teams"`);
        await queryRunner.query(`DROP TABLE "matches"`);
        await queryRunner.query(`DROP TYPE "matches_phase_enum"`);
        await queryRunner.query(`DROP TYPE "matches_state_enum"`);
        await queryRunner.query(`DROP TABLE "match_stats"`);
        await queryRunner.query(`DROP TABLE "match_team_results"`);
    }

}
