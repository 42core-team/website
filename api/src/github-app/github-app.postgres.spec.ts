jest.mock("../event/event.service", () => ({
  EventService: class EventService {},
}));

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DataSource } from "typeorm";
import { EventEntity } from "../event/entities/event.entity";
import { GithubInstallationEntity } from "../github-api/entities/github-installation.entity";
import { RepositoryStatus, TeamEntity } from "../team/entities/team.entity";
import { UserEntity } from "../user/entities/user.entity";
import { GithubInstallStateSigner } from "./github-app-state";
import { GithubAppService } from "./github-app.service";

// A dedicated test database is required; each run owns only its random schema.
const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

postgres("GitHub App connection (PostgreSQL)", () => {
  const schema = `github_app_test_${randomUUID().replaceAll("-", "")}`;
  let database: DataSource;
  let service: GithubAppService;
  let userId: string;

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

    const user = await database.getRepository(UserEntity).save({
      githubId: "1001",
      githubAccessToken: "",
      email: "organizer@example.com",
      username: "organizer",
      name: "Organizer",
    });
    userId = user.id;
    service = new GithubAppService(
      {
        isEnabled: () => true,
        getInstallation: async (id: number) => ({
          id,
          account: { id: 5, login: "core-org", type: "Organization" },
          repository_selection: "all",
          permissions: {
            administration: "write",
            contents: "write",
            members: "read",
          },
          suspended_at: null,
        }),
        getInstallationToken: async () => "installation-token",
      } as never,
      {} as never,
      { getOrThrow: () => "jwt-secret", get: () => undefined } as never,
      database,
      { can: async () => true } as never,
    );
    service.fetch = (async (url: string | URL | Request) =>
      new Response(
        JSON.stringify(
          new URL(String(url)).pathname.startsWith("/user/")
            ? { login: "organizer" }
            : { role: "admin", state: "active" },
        ),
      )) as typeof fetch;
  });

  afterAll(async () => {
    if (database?.isInitialized) {
      await database.query(`DROP SCHEMA "${schema}" CASCADE`);
      await database.destroy();
    }
  });

  async function createEvent(githubOrg: string) {
    return database.getRepository(EventEntity).save({
      name: randomUUID(),
      githubOrg,
      minTeamSize: 1,
      maxTeamSize: 4,
      startDate: new Date("2099-01-01"),
      submissionDeadline: new Date("2100-01-01"),
      scheduledEndDate: new Date("2100-01-01"),
      endDate: new Date("2100-01-01"),
    });
  }

  function stateFor(eventId: string) {
    return new GithubInstallStateSigner("jwt-secret").sign({
      eventId,
      userId,
    });
  }

  it("links the event to the installation", async () => {
    const event = await createEvent("");
    await database.getRepository(TeamEntity).save({
      name: randomUUID(),
      event: { id: event.id },
    });

    await service.completeInstallation({ id: userId }, 77, stateFor(event.id));

    const saved = await database.getRepository(EventEntity).findOneOrFail({
      where: { id: event.id },
      relations: { githubInstallation: true },
    });
    expect(saved.githubOrg).toBe("core-org");
    expect(saved.githubInstallation).toMatchObject({
      installationId: 77,
      accountLogin: "core-org",
    });
    expect(await database.getRepository(GithubInstallationEntity).count()).toBe(
      1,
    );
  });

  it("refuses to move an event whose repositories are being created", async () => {
    const event = await createEvent("old-org");
    await database.getRepository(TeamEntity).save({
      name: randomUUID(),
      event: { id: event.id },
      repositoryStatus: RepositoryStatus.PROVISIONING,
    });

    await expect(
      service.completeInstallation({ id: userId }, 78, stateFor(event.id)),
    ).rejects.toThrow("already have repositories in old-org");
    expect(
      (
        await database
          .getRepository(EventEntity)
          .findOneByOrFail({ id: event.id })
      ).githubInstallationId,
    ).toBeNull();
  });
});
