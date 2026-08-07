import { MigrationInterface, QueryRunner } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { decryptSecret, encryptSecret } from "../../src/common/encryption";

export class EncryptUserToken1757351174916 implements MigrationInterface {
  configService = new ConfigService();

  public async up(queryRunner: QueryRunner): Promise<void> {
    const users: {
      id: string;
      githubAccessToken: string;
    }[] = await queryRunner.query("select * from users");

    await Promise.all(
      users.map(async (user) => {
        const encryptedToken = encryptSecret(
          user.githubAccessToken,
          this.configService.getOrThrow("API_SECRET_ENCRYPTION_KEY"),
        );
        await queryRunner.query(
          `update users set "githubAccessToken" = $1 where id = $2`,
          [encryptedToken, user.id],
        );
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const users: {
      id: string;
      githubAccessToken: string;
    }[] = await queryRunner.query("select * from users");

    await Promise.all(
      users.map(async (user) => {
        const decryptedToken = decryptSecret(
          user.githubAccessToken,
          this.configService.getOrThrow<string>("API_SECRET_ENCRYPTION_KEY"),
        );
        await queryRunner.query(
          `update users set "githubAccessToken" = $1 where id = $2`,
          [decryptedToken, user.id],
        );
      }),
    );
  }
}
