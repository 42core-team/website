import { MigrationInterface, QueryRunner } from "typeorm";

export class PrivateEvent1757408966479 implements MigrationInterface {
  name = "PrivateEvent1757408966479";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ADD "isPrivate" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ALTER COLUMN "state" SET DEFAULT 'CODING_PHASE'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "events" ALTER COLUMN "state" SET DEFAULT 'TEAM_FINDING'`,
    );
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "isPrivate"`);
  }
}
