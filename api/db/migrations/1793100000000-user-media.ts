import { MigrationInterface, QueryRunner } from "typeorm";
export class UserMedia1793100000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users"
        ADD COLUMN "pictureSmallUploadId" uuid,
        ADD COLUMN "pictureLargeUploadId" uuid,
        ADD COLUMN "backgroundLargeUploadId" uuid,
        ADD CONSTRAINT "users_picture_small_upload_fk" FOREIGN KEY ("pictureSmallUploadId") REFERENCES "media_uploads"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "users_picture_large_upload_fk" FOREIGN KEY ("pictureLargeUploadId") REFERENCES "media_uploads"("id") ON DELETE SET NULL,
        ADD CONSTRAINT "users_background_large_upload_fk" FOREIGN KEY ("backgroundLargeUploadId") REFERENCES "media_uploads"("id") ON DELETE SET NULL`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users"
        DROP CONSTRAINT "users_background_large_upload_fk",
        DROP CONSTRAINT "users_picture_large_upload_fk",
        DROP CONSTRAINT "users_picture_small_upload_fk",
        DROP COLUMN "backgroundLargeUploadId",
        DROP COLUMN "pictureLargeUploadId",
        DROP COLUMN "pictureSmallUploadId"`,
    );
  }
}
