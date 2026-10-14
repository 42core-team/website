import { BadRequestException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { EntityManager, Repository } from "typeorm";
import { LockKeys } from "../constants";
import sharp from "sharp";
import { TeamEntity } from "./entities/team.entity";
import { MediaUploadEntity } from "../media/entities/media-upload.entity";
import { processTeamImage, TeamImageService } from "./team-image.service";

const input = () =>
  sharp({
    create: { width: 1800, height: 900, channels: 4, background: "#4080a080" },
  })
    .png()
    .toBuffer();

afterEach(() => jest.restoreAllMocks());

describe("team image cleanup locking", () => {
  function setup(acquired = true, region?: string) {
    const manager = {
      query: jest.fn().mockResolvedValue([{ acquired }]),
      find: jest.fn().mockResolvedValue([]),
    };
    const transaction = jest.fn(
      async (run: (manager: EntityManager) => Promise<void>) =>
        run(manager as unknown as EntityManager),
    );
    const service = new TeamImageService(
      new ConfigService({
        MEDIA_S3_ENDPOINT: "http://localhost:9000",
        MEDIA_S3_BUCKET: "test",
        MEDIA_S3_REGION: region,
        MEDIA_S3_ACCESS_KEY_ID: "test",
        MEDIA_S3_SECRET_ACCESS_KEY: "test",
      }),
      { manager: { transaction } } as unknown as Repository<TeamEntity>,
    );
    const send = jest
      .spyOn(S3Client.prototype, "send")
      .mockImplementation(async () => ({}));
    const destroy = jest.spyOn(S3Client.prototype, "destroy");
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
    return { service, manager, transaction, send, destroy };
  }

  it.each([
    [undefined, "eu01"],
    ["", "eu01"],
    ["local", "local"],
  ])("uses region %s with resolved value %s", async (region, expected) => {
    const { service, send } = setup(true, region);
    await service.cleanup();
    const client = send.mock.contexts[0] as S3Client;
    await expect(client.config.region()).resolves.toBe(expected);
  });

  it("skips the entire sweep when another replica owns the lock", async () => {
    const { service, manager, send } = setup(false);
    await service.cleanup();
    expect(manager.query).toHaveBeenCalledWith(
      "SELECT pg_try_advisory_xact_lock($1) AS acquired",
      [LockKeys.TEAM_IMAGE_CLEANUP],
    );
    expect(manager.find).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("holds the transaction through all pages and deletes only old unreferenced files", async () => {
    const { service, manager, transaction, send, destroy } = setup();
    manager.find.mockResolvedValue([
      { objectKey: "teams/used" },
      { objectKey: "teams/used-large" },
      { objectKey: "images/user-used", teamId: null, userId: "user" },
    ]);
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
    let finishDelete!: () => void;
    let deletionStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      deletionStarted = resolve;
    });
    send.mockImplementation(async (command) => {
      if (command instanceof ListObjectsV2Command) {
        expect(command.input.Prefix).toBe("images/");
        return command.input.ContinuationToken
          ? {
              Contents: [{ Key: "teams/orphan", LastModified: old }],
            }
          : {
              IsTruncated: true,
              NextContinuationToken: "next",
              Contents: [
                { Key: "teams/used", LastModified: old },
                { Key: "teams/new", LastModified: new Date() },
                { Key: "images/user-used", LastModified: old },
              ],
            };
      }
      expect(command).toBeInstanceOf(DeleteObjectsCommand);
      expect((command as DeleteObjectsCommand).input.Delete?.Objects).toEqual([
        { Key: "teams/orphan" },
      ]);
      deletionStarted();
      await new Promise<void>((resolve) => {
        finishDelete = resolve;
      });
      return {};
    });
    let finished = false;
    const cleanup = service.cleanup().then(() => {
      finished = true;
    });
    await started;
    expect(finished).toBe(false);
    expect(destroy).not.toHaveBeenCalled();
    finishDelete();
    await cleanup;
    await expect(transaction.mock.results[0].value).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(3);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("propagates storage failure out of the transaction so it rolls back and releases its lock", async () => {
    const { service, transaction, send, destroy } = setup();
    send.mockRejectedValue(new Error("storage unavailable") as never);
    await service.cleanup();
    await expect(transaction.mock.results[0].value).rejects.toThrow(
      "storage unavailable",
    );
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      "Media upload cleanup failed",
      expect.any(Error),
    );
  });
});

describe("team image processing", () => {
  it("applies a 15-second timeout to still-image decoding and both outputs", async () => {
    const timeout = jest.spyOn(sharp.prototype, "timeout");
    await processTeamImage(await input(), "picture");
    expect(timeout).toHaveBeenCalledTimes(3);
    expect(timeout.mock.calls).toEqual([
      [{ seconds: 15 }],
      [{ seconds: 15 }],
      [{ seconds: 15 }],
    ]);
  });

  it.each(["picture", "background"] as const)(
    "preserves GIF frames, timing, loop and crop for %s",
    async (kind) => {
      const pixels = Buffer.alloc(80 * 40 * 2 * 3);
      for (let frame = 0; frame < 2; frame++) {
        for (let y = 0; y < 40; y++) {
          for (let x = 0; x < 80; x++) {
            const offset = ((frame * 40 + y) * 80 + x) * 3;
            // Left half alternates red/blue; right half is green and must be cropped out.
            pixels[offset + (x >= 40 ? 1 : frame === 0 ? 0 : 2)] = 255;
          }
        }
      }
      const gif = await sharp(pixels, {
        raw: { width: 80, height: 80, channels: 3, pageHeight: 40 },
      })
        .gif({ delay: [120, 240], loop: 3 })
        .toBuffer();
      const outputs = await processTeamImage(gif, kind, 0, 50, 0.5);
      expect(outputs).toHaveLength(kind === "picture" ? 2 : 1);
      for (const output of outputs) {
        const meta = await sharp(output, { animated: true }).metadata();
        expect(meta.format).toBe("webp");
        expect(meta.pages).toBe(2);
        expect(meta.delay).toEqual([120, 240]);
        expect(meta.loop).toBe(3);
        expect([meta.width, meta.pageHeight]).toEqual(
          kind === "picture" ? [20, 20] : [40, 12],
        );
        const first = await sharp(output, { page: 0 }).stats();
        const second = await sharp(output, { page: 1 }).stats();
        expect(first.channels[0].mean).toBeGreaterThan(240);
        expect(second.channels[2].mean).toBeGreaterThan(240);
        expect(first.channels[1].mean).toBeLessThan(15);
        expect(second.channels[1].mean).toBeLessThan(15);
      }
    },
  );

  it("accepts a single-frame GIF", async () => {
    const gif = await sharp(await input())
      .gif()
      .toBuffer();
    const [output] = await processTeamImage(gif, "background");
    const meta = await sharp(output).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([1600, 480, "webp"]);
  });

  it("rejects GIFs above the frame limit", async () => {
    const pixels = Buffer.concat(
      Array.from({ length: 201 }, (_, i) =>
        Buffer.alloc(4 * 4 * 3, (i % 2) * 255),
      ),
    );
    const gif = await sharp(pixels, {
      raw: { width: 4, height: 4 * 201, channels: 3, pageHeight: 4 },
    })
      .gif()
      .toBuffer();
    await expect(processTeamImage(gif, "picture")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
  it.each([
    [
      "picture",
      [
        [128, 128],
        [512, 512],
      ],
    ],
    ["background", [[1600, 480]]],
  ] as const)(
    "produces the expected %s variants without metadata",
    async (kind, sizes) => {
      const outputs = await processTeamImage(await input(), kind);
      const metadata = await Promise.all(
        outputs.map((buffer) => sharp(buffer).metadata()),
      );
      expect(metadata.map((m) => [m.width, m.height])).toEqual(sizes);
      for (const image of metadata) {
        expect(image.format).toBe("webp");
        expect(image.exif).toBeUndefined();
        expect(image.hasAlpha).toBe(true);
      }
    },
  );
  it("rejects corrupt files and SVG even though sharp can decode SVG", async () => {
    for (const text of [
      "not an image",
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
    ]) {
      await expect(
        processTeamImage(Buffer.from(text), "picture"),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });
  it("does not upscale small images", async () => {
    const tiny = await sharp({
      create: { width: 32, height: 32, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    const [, large] = await processTeamImage(tiny, "picture");
    expect((await sharp(large).metadata()).width).toBe(32);
  });
  it("applies the selected horizontal crop", async () => {
    const left = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    const source = await sharp({
      create: { width: 200, height: 100, channels: 3, background: "blue" },
    })
      .composite([{ input: left, left: 0, top: 0 }])
      .png()
      .toBuffer();
    const [red] = await processTeamImage(source, "picture", 0, 50);
    const [blue] = await processTeamImage(source, "picture", 100, 50);
    expect((await sharp(red).stats()).channels[0].mean).toBeGreaterThan(240);
    expect((await sharp(blue).stats()).channels[2].mean).toBeGreaterThan(240);
  });
});

describe("team image publishing", () => {
  const config = new ConfigService({
    MEDIA_S3_ENDPOINT: "http://localhost:9000",
    MEDIA_S3_BUCKET: "test",
    MEDIA_S3_ACCESS_KEY_ID: "test",
    MEDIA_S3_SECRET_ACCESS_KEY: "test",
  });
  function setup() {
    const manager = {
      findOneOrFail: jest.fn().mockResolvedValue({ id: "team" }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn().mockResolvedValue([]),
    };
    const transaction = jest.fn(
      async (run: (manager: EntityManager) => Promise<void>) =>
        run(manager as unknown as EntityManager),
    );
    const service = new TeamImageService(config, {
      manager: { transaction },
    } as unknown as Repository<TeamEntity>);
    return { service, manager, transaction };
  }

  it("uploads and publishes only one background file", async () => {
    const send = jest
      .spyOn(S3Client.prototype, "send")
      .mockImplementation(async () => ({}));
    const { service, manager } = setup();
    const result = await service.upload(
      "team",
      "background",
      await input(),
      50,
      50,
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(Object.keys(result)).toEqual(["large"]);
    expect(result.large).toMatch(/^images\/[\w-]+\/background-large.webp$/);
    expect(manager.save).toHaveBeenCalledWith(MediaUploadEntity, [
      {
        teamId: "team",
        userId: null,
        kind: "background",
        variant: "large",
        objectKey: result.large,
      },
    ]);
  });
  it("keeps the current database reference if storing the second variant fails", async () => {
    const send = jest
      .spyOn(S3Client.prototype, "send")
      .mockImplementationOnce(async () => ({}))
      .mockImplementationOnce(async () => {
        throw new Error("storage unavailable");
      });
    const { service, transaction, manager } = setup();
    await expect(
      service.upload("team", "picture", await input(), 50, 50),
    ).rejects.toThrow("storage unavailable");
    expect(send).toHaveBeenCalledTimes(2);
    expect(transaction).not.toHaveBeenCalled();
    expect(manager.delete).not.toHaveBeenCalled();
  });
  it("publishes immutable keys after both uploads and removes only the reference", async () => {
    const send = jest
      .spyOn(S3Client.prototype, "send")
      .mockImplementation(async () => ({}));
    const { service, manager, transaction } = setup();
    const result = await service.upload(
      "team",
      "picture",
      await input(),
      50,
      50,
    );
    expect(send).toHaveBeenCalledTimes(2);
    expect(manager.findOneOrFail).toHaveBeenCalledWith(TeamEntity, {
      where: { id: "team" },
      lock: { mode: "pessimistic_write" },
      loadEagerRelations: false,
    });
    expect(manager.delete).toHaveBeenCalledWith(MediaUploadEntity, {
      teamId: "team",
      kind: "picture",
    });
    expect(manager.save).toHaveBeenCalledWith(MediaUploadEntity, [
      {
        teamId: "team",
        userId: null,
        kind: "picture",
        variant: "small",
        objectKey: result.small,
      },
      {
        teamId: "team",
        userId: null,
        kind: "picture",
        variant: "large",
        objectKey: result.large,
      },
    ]);
    expect(send.mock.invocationCallOrder[1]).toBeLessThan(
      transaction.mock.invocationCallOrder[0],
    );
    expect(result.small).toMatch(/^images\/[\w-]+\/picture-small.webp$/);
    await service.remove("team", "picture");
    expect(manager.delete).toHaveBeenLastCalledWith(MediaUploadEntity, {
      teamId: "team",
      kind: "picture",
    });
    expect(manager.save).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it("does not publish partial variants when the database transaction fails", async () => {
    jest.spyOn(S3Client.prototype, "send").mockImplementation(async () => ({}));
    const { service, manager, transaction } = setup();
    manager.save.mockRejectedValue(new Error("database unavailable"));
    await expect(
      service.upload("team", "picture", await input(), 50, 50),
    ).rejects.toThrow("database unavailable");
    await expect(transaction.mock.results[0].value).rejects.toThrow(
      "database unavailable",
    );
  });
});

it("extracts the smaller selected area instead of the full image", async () => {
  const center = await sharp({
    create: { width: 200, height: 200, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  const source = await sharp({
    create: { width: 800, height: 800, channels: 3, background: "blue" },
  })
    .composite([{ input: center, left: 300, top: 300 }])
    .png()
    .toBuffer();
  const [, cropped] = await processTeamImage(source, "picture", 50, 50, 0.25);
  expect((await sharp(cropped).metadata()).width).toBe(200);
  const stats = await sharp(cropped).stats();
  expect(stats.channels[0].mean).toBeGreaterThan(240);
  expect(stats.channels[2].mean).toBeLessThan(15);
});
