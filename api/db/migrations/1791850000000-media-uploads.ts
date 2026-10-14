import { MigrationInterface, QueryRunner } from "typeorm";
export class MediaUploads1791850000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "media_uploads" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "objectKey" varchar NOT NULL UNIQUE,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "media_uploads_pkey" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams"
        ADD COLUMN "pictureSmallUploadId" uuid,
        ADD COLUMN "pictureLargeUploadId" uuid,
        ADD COLUMN "backgroundLargeUploadId" uuid,
        ADD CONSTRAINT "teams_picture_small_upload_fk" FOREIGN KEY ("pictureSmallUploadId") REFERENCES "media_uploads"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "teams_picture_large_upload_fk" FOREIGN KEY ("pictureLargeUploadId") REFERENCES "media_uploads"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "teams_background_large_upload_fk" FOREIGN KEY ("backgroundLargeUploadId") REFERENCES "media_uploads"("id") ON DELETE SET NULL`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "teams"
        DROP CONSTRAINT "teams_background_large_upload_fk",
        DROP CONSTRAINT "teams_picture_large_upload_fk",
        DROP CONSTRAINT "teams_picture_small_upload_fk",
        DROP COLUMN "backgroundLargeUploadId",
        DROP COLUMN "pictureLargeUploadId",
        DROP COLUMN "pictureSmallUploadId"`,
    );
    await queryRunner.query(`DROP TABLE "media_uploads"`);
  }
}
