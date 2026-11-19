import {
  resetUploadCooldowns,
  UPLOAD_FAILURE_COOLDOWN_MS,
} from "../media/upload-cooldown";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import { EntityManager, In, Repository } from "typeorm";
import sharp from "sharp";
import { UserEntity } from "./entities/user.entity";
import { MediaUploadEntity } from "../media/entities/media-upload.entity";
import { UserImageService } from "./user-image.service";

beforeEach(resetUploadCooldowns);
afterEach(() => jest.restoreAllMocks());

describe("user image service", () => {
  const config = new ConfigService({
    MEDIA_S3_ENDPOINT: "http://localhost:9000",
    MEDIA_S3_BUCKET: "test",
    MEDIA_S3_ACCESS_KEY_ID: "test",
    MEDIA_S3_SECRET_ACCESS_KEY: "test",
  });
  function setup() {
    const manager = {
      findOneOrFail: jest.fn().mockResolvedValue({
        id: "user",
        pictureSmallUploadId: "old-small",
        pictureLargeUploadId: "old-large",
        backgroundLargeUploadId: null,
      }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      find: jest.fn().mockImplementation(async (_entity, options) =>
        (options.where.id.value as string[]).map((id) => ({
          id,
          objectKey: `images/${id}.webp`,
        })),
      ),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest
        .fn()
        .mockImplementation(
          async (_entity, rows: Array<{ objectKey: string }>) =>
            rows.map((row, idx) => ({ id: `new-${idx + 1}`, ...row })),
        ),
    };
    const transaction = jest.fn(
      async (run: (manager: EntityManager) => Promise<void>) =>
        run(manager as unknown as EntityManager),
    );
    const service = new UserImageService(config, {
      manager: { transaction },
    } as unknown as Repository<UserEntity>);
    return { service, manager, transaction };
  }
  const input = () =>
    sharp({
      create: { width: 600, height: 600, channels: 4, background: "#4080a0" },
    })
      .png()
      .toBuffer();

  it("replaces the uploaded picture and deletes the old references", async () => {
    const send = jest
      .spyOn(S3Client.prototype, "send")
      .mockImplementation(async () => ({}));
    const { service, manager } = setup();
    const result = await service.upload(
      "user",
      "picture",
      await input(),
      50,
      50,
    );
    expect(send).toHaveBeenCalledTimes(3); // two uploads, then the old keys
    expect(result.large).toMatch(/^images\/[\w-]+\/picture-large.webp$/);
    expect(manager.findOneOrFail).toHaveBeenCalledWith(
      UserEntity,
      expect.objectContaining({ where: { id: "user" } }),
    );
    expect(manager.update).toHaveBeenCalledWith(
      UserEntity,
      { id: "user" },
      {
        pictureSmallUploadId: "new-1",
        pictureLargeUploadId: "new-2",
        updatedAt: expect.any(Function),
      },
    );
    expect(manager.delete).toHaveBeenCalledWith(MediaUploadEntity, {
      id: In(["old-small", "old-large"]),
    });
  });

  it("removing the picture only clears the user's references", async () => {
    jest.spyOn(S3Client.prototype, "send").mockImplementation(async () => ({}));
    const { service, manager } = setup();
    await service.remove("user", "picture");
    expect(manager.update).toHaveBeenCalledWith(
      UserEntity,
      { id: "user" },
      {
        pictureSmallUploadId: null,
        pictureLargeUploadId: null,
        updatedAt: expect.any(Function),
      },
    );
  });

  it("deletes the old objects only after the transaction commits", async () => {
    const send = jest
      .spyOn(S3Client.prototype, "send")
      .mockImplementation(async () => ({}));
    const { service, transaction } = setup();
    await service.upload("user", "picture", await input(), 50, 50);
    const deleteCall = send.mock.calls.findIndex(
      ([command]) => command instanceof DeleteObjectsCommand,
    );
    expect(
      (send.mock.calls[deleteCall][0] as DeleteObjectsCommand).input.Delete
        ?.Objects,
    ).toEqual([
      { Key: "images/old-small.webp" },
      { Key: "images/old-large.webp" },
    ]);
    expect(send.mock.invocationCallOrder[deleteCall]).toBeGreaterThan(
      transaction.mock.invocationCallOrder[0],
    );
  });

  it("does not fail the request when deleting old objects fails", async () => {
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    jest
      .spyOn(S3Client.prototype, "send")
      .mockImplementation(async (command) => {
        if (command instanceof DeleteObjectsCommand)
          throw new Error("storage unavailable");
        return {};
      });
    const { service } = setup();
    await expect(
      service.upload("user", "picture", await input(), 50, 50),
    ).resolves.toMatchObject({ small: expect.any(String) });
    await expect(service.remove("user", "picture")).resolves.toBeUndefined();
    expect(Logger.prototype.warn).toHaveBeenCalledTimes(2);
  });

  it("answers 429 for a second upload within the cooldown", async () => {
    jest.spyOn(S3Client.prototype, "send").mockImplementation(async () => ({}));
    const { service } = setup();
    await service.upload("user", "picture", await input(), 50, 50);
    await expect(
      service.upload("user", "picture", await input(), 50, 50),
    ).rejects.toMatchObject({ status: 429 });
    // Another owner and deletes are unaffected.
    await expect(
      service.upload("other", "picture", await input(), 50, 50),
    ).resolves.toBeDefined();
    await expect(service.remove("user", "picture")).resolves.toBeUndefined();
  });

  it("allows a background right after a picture", async () => {
    jest.spyOn(S3Client.prototype, "send").mockImplementation(async () => ({}));
    const { service } = setup();
    await service.upload("user", "picture", await input(), 50, 50);
    await expect(
      service.upload("user", "background", await input(), 50, 50),
    ).resolves.toBeDefined();
  });

  it("a failed upload starts only the short cooldown", async () => {
    jest.spyOn(S3Client.prototype, "send").mockImplementation(async () => ({}));
    const { service } = setup();
    await expect(
      service.upload("user", "picture", Buffer.from("not an image"), 50, 50),
    ).rejects.toThrow();
    await expect(
      service.upload("user", "picture", await input(), 50, 50),
    ).rejects.toMatchObject({ status: 429 });
    // Other kinds and owners are unaffected.
    await expect(
      service.upload("user", "background", await input(), 50, 50),
    ).resolves.toBeDefined();
  });

  it("the failure cooldown expires after 2 seconds, well before the 10 second one", async () => {
    jest.spyOn(S3Client.prototype, "send").mockImplementation(async () => ({}));
    const { service } = setup();
    const now = jest.spyOn(Date, "now");
    now.mockReturnValue(1_000_000);
    await expect(
      service.upload("user", "picture", Buffer.from("not an image"), 50, 50),
    ).rejects.toThrow();
    now.mockReturnValue(1_000_000 + UPLOAD_FAILURE_COOLDOWN_MS - 1);
    await expect(
      service.upload("user", "picture", await input(), 50, 50),
    ).rejects.toMatchObject({ status: 429 });
    now.mockReturnValue(1_000_000 + UPLOAD_FAILURE_COOLDOWN_MS);
    await expect(
      service.upload("user", "picture", await input(), 50, 50),
    ).resolves.toBeDefined();
    // The success cooldown is still the long one.
    now.mockReturnValue(1_000_000 + UPLOAD_FAILURE_COOLDOWN_MS + 5_000);
    await expect(
      service.upload("user", "picture", await input(), 50, 50),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("rejects non-image uploads", async () => {
    jest.spyOn(S3Client.prototype, "send").mockImplementation(async () => ({}));
    const { service } = setup();
    await expect(
      service.upload("user", "background", Buffer.from("not an image"), 50, 50),
    ).rejects.toThrow("valid JPEG");
  });
});
