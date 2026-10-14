import { MigrationInterface, QueryRunner } from "typeorm";
export class MediaUploads1791850000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "media_uploads" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "teamId" uuid,
        "userId" uuid,
        "kind" varchar NOT NULL,
        "variant" varchar NOT NULL,
        "objectKey" varchar NOT NULL UNIQUE,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "media_uploads_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "media_uploads_team_fk" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE,
        CONSTRAINT "media_uploads_user_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "media_uploads_owner_check" CHECK (("teamId" IS NULL) <> ("userId" IS NULL)),
        CONSTRAINT "media_uploads_kind_check" CHECK ("kind" IN ('picture', 'background')),
        CONSTRAINT "media_uploads_variant_check" CHECK ("variant" IN ('small', 'large')),
        CONSTRAINT "media_uploads_background_check" CHECK ("kind" <> 'background' OR "variant" = 'large')
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "media_uploads_team_variant_unique" ON "media_uploads" ("teamId", "kind", "variant") WHERE "teamId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "media_uploads_user_variant_unique" ON "media_uploads" ("userId", "kind", "variant") WHERE "userId" IS NOT NULL`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "media_uploads"`);
  }
}
