import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { ConfigService } from "@nestjs/config";
import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import { DataSource, IsNull } from "typeorm";
import sharp from "sharp";
import { RefreshTokenEntity } from "../auth/entities/refresh-token.entity";
import { RefreshTokenService } from "../auth/refresh-token.service";
import { UserEntity } from "../user/entities/user.entity";
import { UserImageService } from "../user/user-image.service";
import { UserService } from "../user/user.service";
import { USER_ARTWORK_RELATIONS } from "./artwork-relations";
import { resetUploadCooldowns } from "./upload-cooldown";

// Uses the full entity schema (unlike refresh-token.postgres.spec.ts), so
// artwork columns and eager joins are exercised. Each run owns a random schema.
const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

postgres("user media (PostgreSQL, full schema)", () => {
  const schema = `media_test_${randomUUID().replaceAll("-", "")}`;
  const config = new ConfigService({
    MEDIA_S3_ENDPOINT: "http://localhost:9000",
    MEDIA_S3_BUCKET: "test",
    MEDIA_S3_ACCESS_KEY_ID: "test",
    MEDIA_S3_SECRET_ACCESS_KEY: "test",
  });
  let database: DataSource;
  let images: UserImageService;
  let image: Buffer;
  let deletedKeys: string[];

  beforeAll(async () => {
    database = new DataSource({
      type: "postgres",
      url: databaseUrl,
      schema,
      entities: [join(__dirname, "../**/*.entity.ts")],
    });
    await database.initialize();
    await database.query(`CREATE SCHEMA "${schema}"`);
    await database.synchronize();
    images = new UserImageService(config, database.getRepository(UserEntity));
    image = await sharp({
      create: { width: 64, height: 64, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
  });

  beforeEach(() => {
    resetUploadCooldowns();
    deletedKeys = [];
    jest
      .spyOn(S3Client.prototype, "send")
      .mockImplementation(async (command) => {
        if (command instanceof DeleteObjectsCommand)
          deletedKeys.push(
            ...(command.input.Delete?.Objects ?? []).map((o) => o.Key!),
          );
        return {};
      });
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    if (database?.isInitialized) {
      await database.query(`DROP SCHEMA "${schema}" CASCADE`);
      await database.destroy();
    }
  });

  async function createUser(name: string) {
    return database.getRepository(UserEntity).save({
      name,
      username: name,
      email: `${name}@example.test`,
      githubId: randomUUID(),
      githubAccessToken: "token",
    } as Partial<UserEntity> as UserEntity);
  }

  function artworkOf(id: string) {
    return database
      .getRepository(UserEntity)
      .findOneOrFail({ where: { id }, relations: USER_ARTWORK_RELATIONS });
  }

  it("locks users with artwork for session operations and returns the profile artwork", async () => {
    const user = await createUser("alice");
    await images.upload(user.id, "picture", image, 50, 50);
    await images.upload(user.id, "background", image, 50, 50);

    const sessions = new RefreshTokenService(
      database.getRepository(RefreshTokenEntity),
    );
    const login = await sessions.startFamily(user.id);
    const rotated = await sessions.rotate(login.refreshToken);
    expect(rotated.status).toBe("rotated");
    await sessions.revokeAllForUser(user.id);
    await expect(
      database
        .getRepository(RefreshTokenEntity)
        .count({ where: { revokedAt: IsNull() } }),
    ).resolves.toBe(0);

    const profile = await new UserService(
      database.getRepository(UserEntity),
      config,
    ).getUserWithSocialAccounts(user.id);
    expect(profile.picture).toEqual({
      small: expect.any(String),
      large: expect.any(String),
    });
    expect(profile.background).toEqual({ large: expect.any(String) });
  });

  it("deletes only the owner's replaced and removed keys, after commit", async () => {
    const owner = await createUser("owner");
    const other = await createUser("other");
    await images.upload(owner.id, "picture", image, 50, 50);
    await images.upload(other.id, "picture", image, 50, 50);
    const before = await artworkOf(owner.id);
    const otherBefore = await artworkOf(other.id);

    resetUploadCooldowns();
    await images.upload(owner.id, "picture", image, 50, 50);
    expect(deletedKeys).toHaveLength(2);
    await images.remove(owner.id, "picture");
    expect(deletedKeys).toHaveLength(4);
    expect(deletedKeys).toEqual(
      expect.arrayContaining([before.picture!.small, before.picture!.large]),
    );
    expect(deletedKeys).not.toContain(otherBefore.picture!.small);
    expect(deletedKeys).not.toContain(otherBefore.picture!.large);
    expect((await artworkOf(other.id)).picture).toEqual(otherBefore.picture);
  });

  it("deletes nothing when the transaction rolls back", async () => {
    const user = await createUser("rollback");
    await images.upload(user.id, "picture", image, 50, 50);
    const before = await artworkOf(user.id);
    deletedKeys.length = 0;
    resetUploadCooldowns();

    jest
      .spyOn(database.manager.constructor.prototype, "update")
      .mockRejectedValueOnce(new Error("boom"));
    await expect(
      images.upload(user.id, "picture", image, 50, 50),
    ).rejects.toThrow("boom");

    expect(deletedKeys).toEqual([]);
    expect((await artworkOf(user.id)).picture).toEqual(before.picture);
  });

  it("leaves users.updatedAt untouched by artwork changes", async () => {
    // Profile lookups break username ties by updatedAt DESC.
    const user = await createUser("stamp");
    const stamp = async () =>
      (
        await database
          .getRepository(UserEntity)
          .findOneOrFail({ where: { id: user.id } })
      ).updatedAt.getTime();
    const before = await stamp();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await images.upload(user.id, "picture", image, 50, 50);
    expect(await stamp()).toBe(before);
    await images.remove(user.id, "picture");
    expect(await stamp()).toBe(before);
  });
});
