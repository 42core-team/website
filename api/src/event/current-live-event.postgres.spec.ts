// These services pull in the application bootstrap; the query never uses them.
jest.mock("../team/team.service", () => ({ TeamService: class {} }));
jest.mock("../github-api/github-api.service", () => ({
  GithubApiService: class GithubApiService {},
}));
jest.mock("../match/match.service", () => ({
  MatchService: class MatchService {},
}));

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { instanceToPlain } from "class-transformer";
import { DataSource } from "typeorm";
import {
  UserEntity,
  UserEventPermissionEntity,
} from "../user/entities/user.entity";
import { EventEntity } from "./entities/event.entity";
import { EventService } from "./event.service";

// A dedicated test database is required; each run owns only its random schema.
const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

postgres("current live event (PostgreSQL)", () => {
  const schema = `event_test_${randomUUID().replaceAll("-", "")}`;
  let database: DataSource;
  let service: EventService;

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
    service = new EventService(
      database.getRepository(EventEntity),
      database.getRepository(UserEventPermissionEntity),
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      database,
    );
  });

  afterAll(async () => {
    if (database?.isInitialized) {
      await database.query(`DROP SCHEMA "${schema}" CASCADE`);
      await database.destroy();
    }
  });

  async function createUsers(count: number) {
    return Promise.all(
      Array.from({ length: count }, () => {
        const id = randomUUID();
        return database.getRepository(UserEntity).save({
          githubId: id,
          githubAccessToken: "token",
          email: `${id}@example.com`,
          username: id,
          name: id,
        });
      }),
    );
  }

  async function createLiveEvent(userCount: number, isPrivate = false) {
    return database.getRepository(EventEntity).save({
      name: randomUUID().slice(0, 30),
      githubOrg: "org",
      githubOrgSecret: "secret",
      minTeamSize: 1,
      maxTeamSize: 4,
      isPrivate,
      startDate: new Date(Date.now() - 60_000),
      submissionDeadline: new Date("2100-01-01"),
      scheduledEndDate: new Date("2100-01-01"),
      endDate: new Date("2100-01-01"),
      users: await createUsers(userCount),
    });
  }

  it("returns the public live event with the most users, without the users", async () => {
    await createLiveEvent(1);
    const busiest = await createLiveEvent(3);
    await createLiveEvent(2);
    await createLiveEvent(5, true);

    const event = await service.getCurrentLiveEvent();

    expect(event?.id).toBe(busiest.id);
    expect(event?.users).toBeUndefined();
    const body = JSON.stringify(instanceToPlain(event));
    expect(body).not.toContain("@example.com");
    expect(body).not.toContain("githubId");
  });
});
