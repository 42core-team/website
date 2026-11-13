jest.mock("../team/team.service", () => ({ TeamService: class {} }));
jest.mock("../github-api/github-api.service", () => ({
  GithubApiService: class GithubApiService {},
}));
jest.mock("../match/match.service", () => ({
  MatchService: class MatchService {},
}));

jest.mock("./image.util", () => ({ assertImageExists: jest.fn() }));

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DataSource } from "typeorm";
import { UserEntity } from "../user/entities/user.entity";
import { UserRole, UserRoleEntity } from "../user/entities/user-role.entity";
import { EventEntity } from "./entities/event.entity";
import { EventService } from "./event.service";
import { EventStarterTemplateEntity } from "./entities/event-starter-template.entity";
import {
  EventWhitelistEntity,
  WhitelistPlatform,
} from "./entities/event-whitelist.entity";

// A dedicated test database is required; each run owns only its random schema.
const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

postgres("event admins in user_roles (PostgreSQL)", () => {
  const schema = `event_admins_test_${randomUUID().replaceAll("-", "")}`;
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
      database.getRepository(UserRoleEntity),
      database.getRepository(EventStarterTemplateEntity),
      database.getRepository(EventWhitelistEntity),
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

  async function createUser() {
    const id = randomUUID();
    return database.getRepository(UserEntity).save({
      githubId: id,
      githubAccessToken: "token",
      email: `${id}@example.com`,
      username: id,
      name: id,
    });
  }

  async function createEvent() {
    return database.getRepository(EventEntity).save({
      name: randomUUID(),
      githubOrg: "org",
      minTeamSize: 1,
      maxTeamSize: 4,
      startDate: new Date("2020-01-01"),
      submissionDeadline: new Date("2099-01-01"),
      scheduledEndDate: new Date("2099-01-01"),
      endDate: new Date("2099-01-01"),
    });
  }

  function createAs(userId: string, name: string) {
    return service.createEvent(
      userId,
      name,
      "Description",
      undefined,
      undefined,
      "Location",
      Date.now(),
      Date.now() + 60_000,
      1,
      4,
      "game-image",
      "bot-image",
      "visualizer-image",
      "https://github.com/example/mono.git",
      "main",
      "bot",
      "{}",
      "{}",
      true,
    );
  }

  it("creates the event and the creator's ADMIN grant together", async () => {
    const user = await createUser();
    const event = await createAs(user.id, randomUUID());
    expect(event.isPrivate).toBe(true);
    expect(
      await database.getRepository(UserRoleEntity).findOneByOrFail({
        userId: user.id,
        eventId: event.id,
      }),
    ).toMatchObject({ role: UserRole.ADMIN, grantedById: user.id });
  });

  it("rolls back event creation if the creator's grant cannot be saved", async () => {
    const user = await createUser();
    const name = randomUUID();
    await database.query(
      `ALTER TABLE "${schema}".user_roles ADD CONSTRAINT test_reject_grant CHECK ("userId" <> '${user.id}'::uuid)`,
    );
    try {
      await expect(createAs(user.id, name)).rejects.toThrow(
        /test_reject_grant/,
      );
      expect(await database.getRepository(EventEntity).existsBy({ name })).toBe(
        false,
      );
    } finally {
      await database.query(
        `ALTER TABLE "${schema}".user_roles DROP CONSTRAINT test_reject_grant`,
      );
    }
  });

  it("does not read, update or delete templates from another event", async () => {
    const [event, other] = [await createEvent(), await createEvent()];
    const repository = database.getRepository(EventStarterTemplateEntity);
    const template = await repository.save({
      name: "Other",
      basePath: "bot",
      myCoreBotDockerImage: "image",
      event: other,
    });
    await expect(
      service.getTemplateVersion(event.id, template.id),
    ).rejects.toThrow();
    await expect(
      service.updateStarterTemplate(event.id, template.id, { name: "Changed" }),
    ).rejects.toThrow();
    await service.deleteStarterTemplate(event.id, template.id);
    expect(await repository.findOneByOrFail({ id: template.id })).toMatchObject(
      { name: "Other" },
    );
  });

  it("does not delete whitelist entries from another event", async () => {
    const [event, other] = [await createEvent(), await createEvent()];
    const repository = database.getRepository(EventWhitelistEntity);
    const entry = await repository.save({
      platform: WhitelistPlatform.GITHUB,
      username: "other",
      event: other,
    });
    await service.removeFromWhitelist(event.id, entry.id);
    await service.bulkRemoveFromWhitelist(event.id, [entry.id]);
    expect(await repository.existsBy({ id: entry.id })).toBe(true);
  });

  it("adds, lists and removes event admins", async () => {
    const [first, second] = [await createUser(), await createUser()];
    const event = await createEvent();
    await service.addEventAdmin(event.id, first.id, first.id);
    await service.addEventAdmin(event.id, second.id, first.id);
    // Adding an admin twice is a no-op.
    await service.addEventAdmin(event.id, second.id, first.id);

    const admins = await service.getEventAdmins(event.id);
    expect(admins.map((admin) => admin.id)).toEqual([first.id, second.id]);
    expect(
      await database.getRepository(UserRoleEntity).findOneByOrFail({
        userId: second.id,
        eventId: event.id,
      }),
    ).toMatchObject({ role: UserRole.ADMIN, grantedById: first.id });

    await service.removeEventAdmin(event.id, second.id);
    expect(
      (await service.getEventAdmins(event.id)).map((admin) => admin.id),
    ).toEqual([first.id]);
  });

  it("never removes the last admin, even under concurrent removals", async () => {
    const [first, second] = [await createUser(), await createUser()];
    const event = await createEvent();
    await service.addEventAdmin(event.id, first.id, first.id);
    await service.addEventAdmin(event.id, second.id, first.id);

    const results = await Promise.allSettled([
      service.removeEventAdmin(event.id, first.id),
      service.removeEventAdmin(event.id, second.id),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await service.getEventAdmins(event.id)).toHaveLength(1);
    await expect(
      service.removeEventAdmin(
        event.id,
        (await service.getEventAdmins(event.id))[0].id,
      ),
    ).rejects.toThrow("Cannot remove the last admin");
  });

  it("answers 404 for a user who is not an admin of the event", async () => {
    const user = await createUser();
    const event = await createEvent();
    await expect(service.removeEventAdmin(event.id, user.id)).rejects.toThrow(
      "Admin permission not found",
    );
  });

  it("ignores global and moderator roles when listing admins", async () => {
    const [admin, moderator] = [await createUser(), await createUser()];
    const event = await createEvent();
    await database.getRepository(UserRoleEntity).insert([
      { userId: admin.id, role: UserRole.ADMIN, eventId: null },
      { userId: moderator.id, role: UserRole.MODERATOR, eventId: event.id },
    ]);
    expect(await service.getEventAdmins(event.id)).toEqual([]);
  });
});
