import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Global and event-scoped roles replace users.canCreateEvent and the ADMIN
 * rows of user_event_permissions. Both stay for one release but are no longer
 * read or written; the data is copied over here.
 */
export class UserRoles1793000000000 implements MigrationInterface {
  name = "UserRoles1793000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "user_role" AS ENUM('ADMIN', 'MODERATOR', 'PUBLIC_EVENT_CREATOR', 'PRIVATE_EVENT_CREATOR')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "role" "user_role" NOT NULL, "eventId" uuid, "grantedById" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_user_roles_user_role_event" UNIQUE NULLS NOT DISTINCT ("userId", "role", "eventId"), CONSTRAINT "CHK_user_roles_event_scope" CHECK ("eventId" IS NULL OR "role" IN ('ADMIN', 'MODERATOR')), CONSTRAINT "PK_user_roles" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_roles_event" ON "user_roles" ("eventId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "FK_user_roles_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "FK_user_roles_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "FK_user_roles_granted_by" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `INSERT INTO "user_roles" ("userId", "role")
       SELECT "id", 'PUBLIC_EVENT_CREATOR' FROM "users" WHERE "canCreateEvent" = true`,
    );
    // The old table has no unique constraint, so a user may be listed twice.
    await queryRunner.query(
      `INSERT INTO "user_roles" ("userId", "role", "eventId", "createdAt")
       SELECT "userId", 'ADMIN', "eventId", MIN("createdAt")
       FROM "user_event_permissions"
       WHERE "role" = 'ADMIN' AND "userId" IS NOT NULL AND "eventId" IS NOT NULL
       GROUP BY "userId", "eventId"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_roles"`);
    await queryRunner.query(`DROP TYPE "user_role"`);
  }
}
