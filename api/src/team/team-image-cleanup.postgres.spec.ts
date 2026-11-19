import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DataSource } from "typeorm";
import { EventEntity } from "../event/entities/event.entity";
import { MediaUploadEntity } from "../media/entities/media-upload.entity";
import { TeamEntity } from "./entities/team.entity";
import { TeamImageService } from "./team-image.service";

// A dedicated test database is required; each run owns only its random schema.
const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

postgres("team image cleanup (PostgreSQL)", () => {
  const schema = `team_image_test_${randomUUID().replaceAll("-", "")}`;
  let database: DataSource;

  beforeAll(async () => {
    database = new DataSource({
      type: "postgres",
      url: databaseUrl,
      schema,
      entities: [join(__dirname, "../**/*.entity.ts")],
      extra: { application_name: schema },
    });
    await database.initialize();
    await database.query(`CREATE SCHEMA "${schema}"`);
    await database.synchronize();
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    if (database?.isInitialized) {
      await database.query(`DROP SCHEMA "${schema}" CASCADE`);
      await database.destroy();
    }
  });

  it("does not delete artwork of soft-deleted teams but deletes orphans", async () => {
    const key = () => `images/${randomUUID()}`;
    const keys = { small: key(), large: key(), bg: key(), orphan: key() };
    const upload = (objectKey: string) =>
      database.getRepository(MediaUploadEntity).save({ objectKey });
    const event = await database.getRepository(EventEntity).save({
      name: randomUUID(),
      githubOrg: "org",
      minTeamSize: 1,
      maxTeamSize: 2,
      startDate: new Date("2099-01-01"),
      submissionDeadline: new Date("2100-01-01"),
      scheduledEndDate: new Date("2100-01-01"),
      endDate: new Date("2100-01-01"),
    });
    const teams = database.getRepository(TeamEntity);
    const team = await teams.save({
      name: randomUUID(),
      event: { id: event.id },
      pictureSmallUpload: await upload(keys.small),
      pictureLargeUpload: await upload(keys.large),
      backgroundLargeUpload: await upload(keys.bg),
    });
    await teams.softDelete(team.id);
    expect(await teams.findOneBy({ id: team.id })).toBeNull();

    const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const send = jest
      .spyOn(S3Client.prototype, "send")
      .mockImplementation(async (command) =>
        command instanceof ListObjectsV2Command
          ? {
              Contents: Object.values(keys).map((Key) => ({
                Key,
                LastModified: old,
              })),
            }
          : {},
      );
    const service = new TeamImageService(
      new ConfigService({
        MEDIA_S3_ENDPOINT: "http://localhost:9000",
        MEDIA_S3_BUCKET: "test",
        MEDIA_S3_ACCESS_KEY_ID: "test",
        MEDIA_S3_SECRET_ACCESS_KEY: "test",
      }),
      teams,
    );
    await service.cleanup();

    const deleted = send.mock.calls
      .map(([command]) => command)
      .filter((c) => c instanceof DeleteObjectsCommand)
      .map((c) => c as DeleteObjectsCommand)
      .flatMap((c) => c.input.Delete?.Objects?.map((o) => o.Key) ?? []);
    expect(deleted).toEqual([keys.orphan]);
  });
});
