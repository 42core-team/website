jest.mock("../team/team.service", () => ({ TeamService: class {} }));
jest.mock("../github-api/github-api.service", () => ({
  GithubApiService: class GithubApiService {},
}));
jest.mock("../match/match.service", () => ({
  MatchService: class MatchService {},
}));

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DataSource } from "typeorm";
import { UserEntity } from "../user/entities/user.entity";
import { UserRole, UserRoleEntity } from "../user/entities/user-role.entity";
import { EventEntity } from "./entities/event.entity";
import { EventService } from "./event.service";

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
