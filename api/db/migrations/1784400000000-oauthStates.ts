import { MigrationInterface, QueryRunner } from "typeorm";

export class OauthStates1784400000000 implements MigrationInterface {
  name = "OauthStates1784400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "oauth_states" ("stateHash" character varying(64) NOT NULL, "browserHash" character varying(64) NOT NULL, "flow" character varying(16) NOT NULL, "targetUserId" uuid, "codeVerifier" character varying(128), "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_oauth_states_state_hash" PRIMARY KEY ("stateHash"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_oauth_states_expires_at" ON "oauth_states" ("expiresAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_oauth_states_expires_at"`);
    await queryRunner.query(`DROP TABLE "oauth_states"`);
  }
}
