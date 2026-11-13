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
  let adminId: string;
  /** The GitHub organization role of whoever the test checks. */
  let orgRole = "admin";

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
    adminId = (
      await database.getRepository(UserEntity).save({
        githubId: "1002",
        githubAccessToken: "",
        email: "admin@example.com",
        username: "platform-admin",
        name: "Admin",
      })
    ).id;
    service = new GithubAppService(
      {
        isEnabled: () => true,
        listInstallations: async () =>
          [901, 902].map((id) => ({
            id,
            account: { id, login: `owner-org-${id}`, type: "Organization" },
            suspended_at: null,
            permissions: {
              administration: "write",
              contents: "write",
              members: "read",
            },
          })),
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
            : { role: orgRole, state: "active" },
        ),
      )) as typeof fetch;
  });

  afterEach(() => {
    orgRole = "admin";
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

  it("lists owned plus shared UUID installations once, excluding inactive rows", async () => {
    const rows = database.getRepository(GithubInstallationEntity);
    const sharedOwned = await rows.save({
      installationId: 902,
      accountId: 902,
      accountLogin: "owner-org-902",
      accountType: "Organization",
      sharedAt: new Date(),
    });
    const shared = await rows.save({
      installationId: 903,
      accountId: 903,
      accountLogin: "shared-org",
      accountType: "Organization",
      sharedAt: new Date(),
    });
    await rows.save([
      {
        installationId: 904,
        accountId: 904,
        accountLogin: "suspended-org",
        accountType: "Organization",
        sharedAt: new Date(),
        suspendedAt: new Date(),
      },
      {
        installationId: 905,
        accountId: 905,
        accountLogin: "deleted-org",
        accountType: "Organization",
        sharedAt: new Date(),
        deletedAt: new Date(),
      },
    ]);
    const listed = await service.listInstallations({ id: userId });
    expect(listed).toEqual([
      {
        id: expect.any(String),
        accountLogin: "owner-org-901",
        accountType: "Organization",
        shared: false,
      },
      {
        id: sharedOwned.id,
        accountLogin: "owner-org-902",
        accountType: "Organization",
        shared: true,
      },
      {
        id: shared.id,
        accountLogin: "shared-org",
        accountType: "Organization",
        shared: true,
      },
    ]);
    expect(await rows.findOneBy({ installationId: 901 })).toMatchObject({
      id: listed[0].id,
    });
    // A cached ownership result must not resurrect an installation disabled
    // by a newer webhook, including an installation that was shared.
    await rows.update(sharedOwned.id, { suspendedAt: new Date() });
    await rows.update(listed[0].id, { deletedAt: new Date() });
    expect(await service.listInstallations({ id: userId })).toEqual([
      {
        id: shared.id,
        accountLogin: "shared-org",
        accountType: "Organization",
        shared: true,
      },
    ]);
    expect(await rows.findOneByOrFail({ id: sharedOwned.id })).toMatchObject({
      suspendedAt: expect.any(Date),
    });
    expect(await rows.findOneByOrFail({ id: listed[0].id })).toMatchObject({
      deletedAt: expect.any(Date),
    });
  });

  describe("shared installations", () => {
    async function knownInstallation(installationId: number) {
      return database.getRepository(GithubInstallationEntity).save({
        installationId,
        accountId: 5,
        accountLogin: "core-org",
        accountType: "Organization",
      });
    }

    it("shares after the owner check and lists who shared it", async () => {
      const row = await knownInstallation(301);
      const linked = await createEvent("");
      await database
        .getRepository(EventEntity)
        .update(linked.id, { githubInstallationId: row.id });

      const shared = await service.share(row.id, { id: adminId });
      expect(shared).toEqual({
        id: row.id,
        accountLogin: "core-org",
        accountType: "Organization",
        status: "active",
        sharedAt: expect.any(Date),
        sharedBy: { id: adminId, username: "platform-admin" },
        eventCount: 1,
      });
      // Sharing again keeps the first admin.
      await service.share(row.id, { id: userId });
      const listed = (await service.listForAdmin()).find(
        ({ id }) => id === row.id,
      );
      expect(listed).toEqual(shared);
    });

    it("refuses to share for an admin who does not own the organization", async () => {
      const row = await knownInstallation(302);
      orgRole = "member";
      await expect(service.share(row.id, { id: adminId })).rejects.toThrow(
        "Only an owner of core-org",
      );
      expect(
        (
          await database
            .getRepository(GithubInstallationEntity)
            .findOneByOrFail({ id: row.id })
        ).sharedAt,
      ).toBeNull();
    });

    it("lets a non-owner link a shared installation, and not once it is unshared", async () => {
      const row = await knownInstallation(303);
      await service.share(row.id, { id: adminId });
      orgRole = "member";

      const event = await createEvent("");
      await service.linkInstallation(event.id, { id: userId }, 303);
      const saved = await database
        .getRepository(EventEntity)
        .findOneByOrFail({ id: event.id });
      expect(saved.githubInstallationId).toBe(row.id);

      await service.unshare(row.id, { id: adminId });
      const other = await createEvent("");
      await expect(
        service.linkInstallation(other.id, { id: userId }, 303),
      ).rejects.toThrow("Only an owner of core-org");
      // Unsharing leaves the linked event alone.
      expect(
        (
          await database
            .getRepository(EventEntity)
            .findOneByOrFail({ id: event.id })
        ).githubInstallationId,
      ).toBe(row.id);
    });

    it("answers 404 for unknown installations", async () => {
      await expect(
        service.share(randomUUID(), { id: adminId }),
      ).rejects.toThrow("Installation not found");
      await expect(
        service.unshare(randomUUID(), { id: adminId }),
      ).rejects.toThrow("Installation not found");
    });
  });
});
