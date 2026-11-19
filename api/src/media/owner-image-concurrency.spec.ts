import { ConfigService } from "@nestjs/config";
import { S3Client } from "@aws-sdk/client-s3";
import { Repository } from "typeorm";
import { TeamEntity } from "../team/entities/team.entity";
import { TeamImageService } from "../team/team-image.service";
import { UserEntity } from "../user/entities/user.entity";
import { UserImageService } from "../user/user-image.service";
import { processImage } from "./image-processing";
import { resetUploadCooldowns } from "./upload-cooldown";

jest.mock("./image-processing", () => ({
  ...jest.requireActual("./image-processing"),
  processImage: jest.fn(),
}));

const config = new ConfigService({
  MEDIA_S3_ENDPOINT: "http://localhost:9000",
  MEDIA_S3_BUCKET: "test",
  MEDIA_S3_ACCESS_KEY_ID: "test",
  MEDIA_S3_SECRET_ACCESS_KEY: "test",
});

/** A repository whose transaction finds an artwork-free owner and succeeds. */
function repository() {
  const manager = {
    findOneOrFail: jest.fn().mockResolvedValue({}),
    save: jest.fn().mockResolvedValue([{ id: "a" }, { id: "b" }]),
    update: jest.fn().mockResolvedValue({}),
  };
  return {
    manager: {
      transaction: async (run: (m: unknown) => unknown) => run(manager),
    },
  };
}

const bytes = Buffer.from("image");

describe("shared image processing limits", () => {
  const releases: Array<() => void> = [];
  const mockedProcess = jest.mocked(processImage);
  let users: UserImageService;
  let teams: TeamImageService;

  beforeEach(() => {
    resetUploadCooldowns();
    releases.length = 0;
    // Each call parks until the test releases it.
    mockedProcess.mockImplementation(
      () =>
        new Promise((resolve) =>
          releases.push(() => resolve([Buffer.from("s"), Buffer.from("l")])),
        ),
    );
    jest.spyOn(S3Client.prototype, "send").mockImplementation(async () => ({}));
    users = new UserImageService(
      config,
      repository() as unknown as Repository<UserEntity>,
    );
    teams = new TeamImageService(
      config,
      repository() as unknown as Repository<TeamEntity>,
    );
  });

  afterEach(async () => {
    // Drain anything still parked so module state is clean for the next test.
    while (releases.length) {
      releases.shift()!();
      await new Promise((resolve) => setImmediate(resolve));
    }
    jest.restoreAllMocks();
    mockedProcess.mockReset();
  });

  const tick = () => new Promise((resolve) => setImmediate(resolve));

  it("allows two concurrent jobs across team and user services, then answers 503", async () => {
    const first = users.upload("u1", "picture", bytes, 50, 50);
    const second = teams.upload("t1", "picture", bytes, 50, 50);
    await tick();
    expect(mockedProcess).toHaveBeenCalledTimes(2);

    await expect(
      users.upload("u2", "picture", bytes, 50, 50),
    ).rejects.toMatchObject({ status: 503 });
    await expect(
      teams.upload("t2", "picture", bytes, 50, 50),
    ).rejects.toMatchObject({ status: 503 });
    expect(mockedProcess).toHaveBeenCalledTimes(2);

    // Freeing one slot admits the next job.
    releases.shift()!();
    await tick();
    const third = users.upload("u2", "picture", bytes, 50, 50);
    await tick();
    expect(mockedProcess).toHaveBeenCalledTimes(3);

    while (releases.length) releases.shift()!();
    await Promise.all([first, second, third]);
  });

  it("allows one in-flight upload per owner and blocks removal meanwhile", async () => {
    const first = users.upload("u1", "picture", bytes, 50, 50);
    await tick();
    await expect(
      users.upload("u1", "background", bytes, 50, 50),
    ).rejects.toMatchObject({ status: 503 });
    await expect(users.remove("u1", "picture")).rejects.toMatchObject({
      status: 503,
    });
    // A team with the same id is a separate owner.
    const team = teams.upload("u1", "picture", bytes, 50, 50);
    await tick();
    expect(mockedProcess).toHaveBeenCalledTimes(2);

    while (releases.length) releases.shift()!();
    await Promise.all([first, team]);
    // The owner is free again once its job finished (backgrounds have no cooldown from the picture).
    const again = users.upload("u1", "background", bytes, 50, 50);
    await tick();
    releases.shift()!();
    await expect(again).resolves.toBeDefined();
  });
});
