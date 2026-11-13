jest.mock("../team/team.service", () => ({ TeamService: class {} }));
jest.mock("../github-api/github-api.service", () => ({
  GithubApiService: class {},
}));
jest.mock("../match/match.service", () => ({ MatchService: class {} }));

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { UserRole } from "../authz";
import { authzTestingModule, principalWith } from "../authz/testing";
import { EventEntity } from "../event/entities/event.entity";
import { GithubInstallationEntity } from "../github-api/entities/github-installation.entity";
import { UserEntity } from "../user/entities/user.entity";
import { AdminEventPresetsController } from "./admin-event-presets.controller";
import { EventPresetEntity } from "./entities/event-preset.entity";
import { EventPresetsService } from "./event-presets.service";
import { PRESET_SETTINGS } from "./testing";

const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

postgres("admin event presets (PostgreSQL)", () => {
  const schema = `event_presets_test_${randomUUID().replaceAll("-", "")}`;
  let database: DataSource;
  let app: INestApplication;
  let adminId: string;
  const principals: Record<string, ReturnType<typeof principalWith>> = {};

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
    const admin = await database.getRepository(UserEntity).save({
      githubId: "1",
      githubAccessToken: "",
      email: "admin@example.com",
      username: "preset-admin",
      name: "Admin",
    });
    adminId = admin.id;
    principals[admin.id] = principalWith(admin.id, UserRole.ADMIN);
    principals.creator = principalWith(
      "creator",
      UserRole.PUBLIC_EVENT_CREATOR,
    );

    const moduleRef = await Test.createTestingModule({
      imports: [authzTestingModule(async (id) => principals[id] ?? null)],
      controllers: [AdminEventPresetsController],
      providers: [
        {
          provide: EventPresetsService,
          useValue: new EventPresetsService(database),
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (database?.isInitialized) {
      await database.query(`DROP SCHEMA "${schema}" CASCADE`);
      await database.destroy();
    }
  });

  beforeEach(async () => {
    await database
      .createQueryBuilder()
      .update(EventEntity)
      .set({ presetId: null })
      .execute();
    await database.getRepository(EventPresetEntity).deleteAll();
  });

  const http = () => request(app.getHttpServer());
  const asAdmin = <T extends request.Test>(req: T) =>
    req.set("x-test-user", adminId);

  function create(body: object = {}) {
    return asAdmin(
      http()
        .post("/admin/event-presets")
        .send({
          name: `Preset ${randomUUID()}`,
          settings: PRESET_SETTINGS,
          ...body,
        }),
    );
  }

  function put(id: string, body: object) {
    return asAdmin(http().put(`/admin/event-presets/${id}`).send(body));
  }

  async function shareableInstallation(shared: boolean) {
    return database.getRepository(GithubInstallationEntity).save({
      installationId: Math.floor(Math.random() * 1e9),
      accountId: 5,
      accountLogin: "core-org",
      accountType: "Organization",
      sharedAt: shared ? new Date() : null,
    });
  }

  const makeDefault = (id: string) =>
    asAdmin(http().post(`/admin/event-presets/${id}/default`));

  it("moves the default and bumps both versions, returning the detail", async () => {
    const previous = (await create({ isDefault: true }).expect(201)).body;
    const next = (await create().expect(201)).body;
    const { body } = await makeDefault(next.id).expect(200);
    expect(body).toMatchObject({
      ...next,
      isDefault: true,
      version: 2,
      updatedAt: expect.any(String),
    });
    await asAdmin(http().get(`/admin/event-presets/${previous.id}`))
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ isDefault: false, version: 2 });
      });
    await makeDefault(next.id)
      .expect(200)
      .expect(({ body }) => expect(body.version).toBe(2));
  });

  it("refuses to default an archived preset", async () => {
    const previous = (await create({ isDefault: true }).expect(201)).body;
    const archived = (await create().expect(201)).body;
    await asAdmin(
      http().post(`/admin/event-presets/${archived.id}/archive`),
    ).expect(200);
    await makeDefault(archived.id).expect(409);
    await asAdmin(http().get(`/admin/event-presets/${previous.id}`))
      .expect(200)
      .expect(({ body }) => expect(body.version).toBe(1));
  });

  it("serializes simultaneous default switches without unique violations or deadlocks", async () => {
    const original = (await create({ isDefault: true }).expect(201)).body;
    const next = (await create().expect(201)).body;
    const third = (await create().expect(201)).body;
    const responses = await Promise.all([
      makeDefault(next.id),
      makeDefault(third.id),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([200, 200]);
    const rows = await database.getRepository(EventPresetEntity).find();
    expect(rows.filter(({ isDefault }) => isDefault)).toHaveLength(1);
    expect(rows.find(({ id }) => id === original.id)?.version).toBe(2);
    expect(rows.map(({ version }) => version).sort()).toEqual([2, 2, 3]);
  });

  it("creates a preset and returns its detail", async () => {
    const { body } = await create({
      name: "  Spring Cup  ",
      description: "For the spring",
      starterTemplates: [
        {
          name: "C",
          basePath: "bots/c/bot",
          myCoreBotDockerImage: "registry.example.com/bot:dev",
        },
      ],
    }).expect(201);
    expect(body).toEqual({
      id: expect.any(String),
      name: "Spring Cup",
      description: "For the spring",
      isDefault: false,
      archivedAt: null,
      version: 1,
      settings: PRESET_SETTINGS,
      starterTemplates: [
        {
          name: "C",
          basePath: "bots/c/bot",
          myCoreBotDockerImage: "registry.example.com/bot:dev",
        },
      ],
      githubInstallation: null,
      warnings: [],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    await asAdmin(http().get(`/admin/event-presets/${body.id}`)).expect(
      200,
      body,
    );
    const stored = await database
      .getRepository(EventPresetEntity)
      .findOneByOrFail({ id: body.id });
    expect(stored).toMatchObject({
      createdById: adminId,
      updatedById: adminId,
    });
  });

  it("normalizes GitHub settings like event settings", async () => {
    const { body } = await create({
      settings: {
        ...PRESET_SETTINGS,
        monorepoUrl: " https://github.com/42core-team/monorepo/ ",
      },
    }).expect(201);
    expect(body.settings.monorepoUrl).toBe(
      "https://github.com/42core-team/monorepo",
    );
  });

  it.each([
    [
      "an unknown setting",
      { settings: { ...PRESET_SETTINGS, githubOrgSecret: "x" } },
    ],
    ["an unknown field", { isPrivate: false }],
    ["null templates", { starterTemplates: null }],
    ["null default flag", { isDefault: null }],
    [
      "a null optional setting",
      { settings: { ...PRESET_SETTINGS, description: null } },
    ],
    [
      "null hours",
      {
        settings: {
          ...PRESET_SETTINGS,
          schedule: { ...PRESET_SETTINGS.schedule, endAfterHours: null },
        },
      },
    ],
    ["no schedule", { settings: { ...PRESET_SETTINGS, schedule: undefined } }],
    [
      "a bad start time",
      {
        settings: {
          ...PRESET_SETTINGS,
          schedule: { startOffsetDays: 0, startTime: "24:00" },
        },
      },
    ],
    [
      "an offset over a year",
      {
        settings: {
          ...PRESET_SETTINGS,
          schedule: { startOffsetDays: 366, startTime: "10:00" },
        },
      },
    ],
    [
      "a deadline at the start",
      {
        settings: {
          ...PRESET_SETTINGS,
          schedule: {
            startOffsetDays: 0,
            startTime: "10:00",
            submissionDeadlineAfterHours: 0,
          },
        },
      },
    ],
    [
      "no team size",
      { settings: { ...PRESET_SETTINGS, maxTeamSize: undefined } },
    ],
    ["a short name", { name: "ab" }],
    [
      "a bad stream URL",
      { settings: { ...PRESET_SETTINGS, streamUrl: "ftp://x" } },
    ],
    [
      "a bad template",
      {
        starterTemplates: [
          { name: "C", basePath: "/abs", myCoreBotDockerImage: "x" },
        ],
      },
    ],
  ])("rejects %s", async (_, body) => {
    await create(body).expect(400);
  });

  it("answers 409 when the name is taken", async () => {
    await create({ name: "Taken" }).expect(201);
    const { body } = await create({ name: "Taken" }).expect(409);
    expect(body.message).toBe("A preset with this name already exists");
  });

  it("switches the default and bumps the previous default's version", async () => {
    const first = (await create({ name: "First", isDefault: true }).expect(201))
      .body;
    const second = (
      await create({ name: "Second", isDefault: true }).expect(201)
    ).body;
    expect(second.isDefault).toBe(true);
    const previous = (
      await asAdmin(http().get(`/admin/event-presets/${first.id}`)).expect(200)
    ).body;
    expect(previous).toMatchObject({ isDefault: false, version: 2 });

    // Through an update, too.
    await put(first.id, {
      version: 2,
      name: "First",
      settings: PRESET_SETTINGS,
      isDefault: true,
    }).expect(200);
    const list = (await asAdmin(http().get("/admin/event-presets")).expect(200))
      .body;
    expect(list.map(({ name, isDefault }) => [name, isDefault])).toEqual([
      ["First", true],
      ["Second", false],
    ]);
  });

  it("updates with the current version and bumps it", async () => {
    const preset = (await create({ description: "old" }).expect(201)).body;
    const { body } = await put(preset.id, {
      version: 1,
      name: "Renamed",
      settings: { ...PRESET_SETTINGS, maxTeamSize: 3 },
    }).expect(200);
    expect(body).toMatchObject({
      name: "Renamed",
      version: 2,
      // Omitted optional fields stay.
      description: "old",
      settings: { maxTeamSize: 3 },
    });
  });

  it("answers 409 for a stale version and keeps the preset", async () => {
    const preset = (await create().expect(201)).body;
    await put(preset.id, {
      version: 1,
      name: preset.name,
      settings: PRESET_SETTINGS,
    }).expect(200);
    const { body } = await put(preset.id, {
      version: 1,
      name: "Lost update",
      settings: PRESET_SETTINGS,
    }).expect(409);
    expect(body).toEqual({ message: "Preset was changed by someone else" });
    const current = await database
      .getRepository(EventPresetEntity)
      .findOneByOrFail({ id: preset.id });
    expect(current).toMatchObject({ name: preset.name, version: 2 });
  });

  it("allows exactly one concurrent update with the same expected version", async () => {
    const preset = (await create().expect(201)).body;
    const responses = await Promise.all([
      put(preset.id, {
        version: 1,
        name: "Concurrent A",
        settings: PRESET_SETTINGS,
      }),
      put(preset.id, {
        version: 1,
        name: "Concurrent B",
        settings: PRESET_SETTINGS,
      }),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(responses.find(({ status }) => status === 409)?.body).toEqual({
      message: "Preset was changed by someone else",
    });
    const current = await database
      .getRepository(EventPresetEntity)
      .findOneByOrFail({ id: preset.id });
    expect(current.version).toBe(2);
    expect(["Concurrent A", "Concurrent B"]).toContain(current.name);
  });

  it("answers 409 when an update takes a used name", async () => {
    await create({ name: "Used" }).expect(201);
    const preset = (await create().expect(201)).body;
    await put(preset.id, {
      version: 1,
      name: "Used",
      settings: PRESET_SETTINGS,
    }).expect(409);
  });

  it("archives, refuses to archive the default, and unarchives", async () => {
    const preset = (await create({ name: "Old" }).expect(201)).body;
    const fallback = (await create({ isDefault: true }).expect(201)).body;

    const { body } = await asAdmin(
      http().post(`/admin/event-presets/${fallback.id}/archive`),
    ).expect(409);
    expect(body.message).toMatch("default preset cannot be archived");

    const archived = (
      await asAdmin(
        http().post(`/admin/event-presets/${preset.id}/archive`),
      ).expect(200)
    ).body;
    expect(archived).toMatchObject({
      archivedAt: expect.any(String),
      version: 2,
    });

    const active = (
      await asAdmin(http().get("/admin/event-presets")).expect(200)
    ).body;
    expect(active.map(({ id }) => id)).toEqual([fallback.id]);
    const all = (
      await asAdmin(
        http().get("/admin/event-presets").query({ includeArchived: "true" }),
      ).expect(200)
    ).body;
    expect(all.map(({ id }) => id)).toEqual([fallback.id, preset.id]);

    // An archived preset cannot become the default.
    await put(preset.id, {
      version: 2,
      name: "Old",
      settings: PRESET_SETTINGS,
      isDefault: true,
    }).expect(409);

    const restored = (
      await asAdmin(
        http().post(`/admin/event-presets/${preset.id}/unarchive`),
      ).expect(200)
    ).body;
    expect(restored).toMatchObject({ archivedAt: null, version: 3 });
  });

  it("duplicates as a non-default copy with a free name", async () => {
    const preset = (
      await create({ name: "Cup", isDefault: true, description: "d" }).expect(
        201,
      )
    ).body;
    const copy = (
      await asAdmin(
        http().post(`/admin/event-presets/${preset.id}/duplicate`),
      ).expect(201)
    ).body;
    expect(copy).toMatchObject({
      name: "Cup (copy)",
      description: "d",
      isDefault: false,
      version: 1,
      settings: PRESET_SETTINGS,
    });
    expect(copy.id).not.toBe(preset.id);
    const again = (
      await asAdmin(
        http().post(`/admin/event-presets/${preset.id}/duplicate`),
      ).expect(201)
    ).body;
    expect(again.name).toBe("Cup (copy 2)");
  });

  it("links only shared installations", async () => {
    const unshared = await shareableInstallation(false);
    await create({ githubInstallationId: unshared.id }).expect(400);
    await create({ githubInstallationId: randomUUID() }).expect(400);

    const shared = await shareableInstallation(true);
    const preset = (
      await create({ githubInstallationId: shared.id }).expect(201)
    ).body;
    expect(preset.githubInstallation).toEqual({
      id: shared.id,
      accountLogin: "core-org",
    });
    const cleared = (
      await put(preset.id, {
        version: 1,
        name: preset.name,
        settings: PRESET_SETTINGS,
        githubInstallationId: null,
      }).expect(200)
    ).body;
    expect(cleared.githubInstallation).toBeNull();
  });

  it("warns about an installation that stopped being shared, and keeps it on save", async () => {
    const shared = await shareableInstallation(true);
    const preset = (
      await create({ name: "Stale", githubInstallationId: shared.id }).expect(
        201,
      )
    ).body;
    expect(preset.warnings).toEqual([]);
    await database
      .getRepository(GithubInstallationEntity)
      .update(shared.id, { sharedAt: null });
    const warning =
      "This preset's GitHub installation core-org is no longer available; the event will be created without one.";

    const list = (await asAdmin(http().get("/admin/event-presets")).expect(200))
      .body;
    expect(
      list.find((row: { id: string }) => row.id === preset.id),
    ).toMatchObject({ warnings: [warning] });
    const detail = (
      await asAdmin(http().get(`/admin/event-presets/${preset.id}`)).expect(200)
    ).body;
    expect(detail).toMatchObject({
      githubInstallation: { id: shared.id, accountLogin: "core-org" },
      warnings: [warning],
    });

    // Other edits still save while the stale link is sent back unchanged.
    const saved = (
      await put(preset.id, {
        version: 1,
        name: "Stale renamed",
        settings: PRESET_SETTINGS,
        githubInstallationId: shared.id,
      }).expect(200)
    ).body;
    expect(saved).toMatchObject({ name: "Stale renamed", warnings: [warning] });
    // Switching to another unshared installation is still refused.
    const other = await shareableInstallation(false);
    await put(preset.id, {
      version: 2,
      name: "Stale renamed",
      settings: PRESET_SETTINGS,
      githubInstallationId: other.id,
    }).expect(400);
  });

  it("lists who updated a preset and how many events use it", async () => {
    const preset = (await create({ name: "Counted" }).expect(201)).body;
    await database.getRepository(EventEntity).save(
      [1, 2].map(() => ({
        name: randomUUID(),
        githubOrg: "",
        minTeamSize: 1,
        maxTeamSize: 4,
        startDate: new Date("2099-01-01"),
        submissionDeadline: new Date("2099-01-02"),
        scheduledEndDate: new Date("2099-01-02"),
        endDate: new Date("2099-01-02"),
        presetId: preset.id,
        presetVersion: 1,
      })),
    );
    const list = (await asAdmin(http().get("/admin/event-presets")).expect(200))
      .body;
    expect(list).toEqual([
      {
        id: preset.id,
        name: "Counted",
        description: null,
        isDefault: false,
        archivedAt: null,
        version: 1,
        updatedAt: preset.updatedAt,
        updatedBy: { id: adminId, username: "preset-admin" },
        eventCount: 2,
        warnings: [],
      },
    ]);
  });

  it("answers 404 for unknown presets and 400 for bad ids", async () => {
    const id = randomUUID();
    await asAdmin(http().get(`/admin/event-presets/${id}`)).expect(404);
    await put(id, {
      version: 1,
      name: "Nope",
      settings: PRESET_SETTINGS,
    }).expect(404);
    for (const action of ["duplicate", "archive", "unarchive", "default"])
      await asAdmin(http().post(`/admin/event-presets/${id}/${action}`)).expect(
        404,
      );
    await asAdmin(http().get("/admin/event-presets/nope")).expect(400);
  });

  it("rejects a bad includeArchived", async () => {
    await asAdmin(
      http().get("/admin/event-presets").query({ includeArchived: "yes" }),
    ).expect(400);
  });

  it("denies event creators", async () => {
    await http()
      .get("/admin/event-presets")
      .set("x-test-user", "creator")
      .expect(403);
  });
});
