import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCampusToSocialAccounts1784380000000
  implements MigrationInterface
{
  name = "AddCampusToSocialAccounts1784380000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "social_accounts" ADD "campusId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "social_accounts" ADD "campusName" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "social_accounts" DROP COLUMN "campusName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "social_accounts" DROP COLUMN "campusId"`,
    );
  }
}
