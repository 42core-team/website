jest.mock("../team/team.service", () => ({ TeamService: class {} }));
jest.mock("../user/user.service", () => ({ UserService: class {} }));
jest.mock("../github-api/github-api.service", () => ({
  GithubApiService: class {},
}));
jest.mock("../match/match.service", () => ({ MatchService: class {} }));

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { UserRole } from "../authz";
import { authzTestingModule } from "../authz/testing";
import { EventStarterTemplateEntity } from "../event/entities/event-starter-template.entity";
import { EventWhitelistEntity } from "../event/entities/event-whitelist.entity";
import { EventEntity } from "../event/entities/event.entity";
import { EventController } from "../event/event.controller";
import { EventService } from "../event/event.service";
import { GithubAppRequestError } from "../github-api/github-app-auth";
import { GithubInstallationEntity } from "../github-api/entities/github-installation.entity";
import { TeamService } from "../team/team.service";
import { UserRoleEntity } from "../user/entities/user-role.entity";
import { UserEntity } from "../user/entities/user.entity";
import { UserService } from "../user/user.service";
import { EventPresetEntity } from "./entities/event-preset.entity";
import { EventPresetsController } from "./event-presets.controller";
import { EventPresetsService } from "./event-presets.service";
import { PRESET_TIME_ZONE } from "./preset-resolver";
import { PRESET_SETTINGS } from "./testing";

const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

const HOUR = 60 * 60 * 1000;
const TEMPLATE = {
  name: "C bot",
  basePath: "bots/c/bot",
  myCoreBotDockerImage: "registry.example.com/bot:c",
};

/** The Berlin wall-clock time of an epoch ms date, as HH:mm. */
function berlinTime(epochMs: number) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: PRESET_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(epochMs);
}

postgres("creating events from presets (PostgreSQL)", () => {
  const schema = `create_preset_test_${randomUUID().replaceAll("-", "")}`;
  let database: DataSource;
  let app: INestApplication;
  let creatorId: string;
  let defaultPreset: EventPresetEntity;
  let otherPreset: EventPresetEntity;
  let installation: GithubInstallationEntity;
  const appAuth = {
    getInstallation: jest.fn(async (id: number) => ({
      id,
      account: { id: 7, login: "private-org", type: "Organization" },
      suspended_at: null,
    })),
    getInstallationToken: jest.fn(async () => "installation-token"),
  };
  let githubFetch: jest.SpyInstance;
  let owner = false;

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

    const eventService = new EventService(
      database.getRepository(EventEntity),
      database.getRepository(UserRoleEntity),
      database.getRepository(EventStarterTemplateEntity),
      database.getRepository(EventWhitelistEntity),
      {} as never,
      {} as never,
      database,
      appAuth as never,
    );
    const moduleRef = await Test.createTestingModule({
      imports: [
        authzTestingModule((id) =>
          database.getRepository(UserEntity).findOne({
            where: { id },
            relations: { roles: true },
          }),
        ),
      ],
      controllers: [EventController, EventPresetsController],
      providers: [
        { provide: EventService, useValue: eventService },
        { provide: TeamService, useValue: {} },
        { provide: UserService, useValue: {} },
        {
          provide: EventPresetsService,
          useValue: new EventPresetsService(database),
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    // Same global setup as main.ts.
    app.useGlobalPipes(new ValidationPipe());
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
    );
    await app.init();
    githubFetch = jest
      .spyOn(global, "fetch")
      .mockImplementation(
        async (url) =>
          new Response(
            JSON.stringify(
              new URL(String(url)).pathname.startsWith("/user/")
                ? { login: "creator" }
                : { role: owner ? "admin" : "member", state: "active" },
            ),
          ),
      );

    const creator = await database.getRepository(UserEntity).save({
      githubId: "1",
      githubAccessToken: "",
      email: "creator@example.com",
      username: "creator",
      name: "Creator",
    });
    creatorId = creator.id;
    await database.getRepository(UserRoleEntity).insert({
      userId: creatorId,
      role: UserRole.PRIVATE_EVENT_CREATOR,
    });
    installation = await database.getRepository(GithubInstallationEntity).save({
      installationId: 77,
      accountId: 5,
      accountLogin: "core-org",
      accountType: "Organization",
      sharedAt: new Date(),
    });
    const presets = database.getRepository(EventPresetEntity);
    defaultPreset = await presets.save({
      name: "Default",
      isDefault: true,
      version: 3,
      settings: { ...PRESET_SETTINGS, description: "From the preset" },
      starterTemplates: [TEMPLATE],
      githubInstallationId: installation.id,
    });
    otherPreset = await presets.save({
      name: "Arena",
      settings: { ...PRESET_SETTINGS, maxTeamSize: 6 },
    });
    await presets.save({
      name: "Archived",
      archivedAt: new Date(),
      settings: PRESET_SETTINGS,
    });
  });

  afterAll(async () => {
    githubFetch?.mockRestore();
    await app?.close();
    if (database?.isInitialized) {
      await database.query(`DROP SCHEMA "${schema}" CASCADE`);
      await database.destroy();
    }
  });

  const http = () => request(app.getHttpServer());
  const create = (body: object) =>
    http()
      .post("/event")
      .set("x-test-user", creatorId)
      .send({ name: `Event ${randomUUID().slice(0, 8)}`, ...body });

  function load(id: string) {
    return database.getRepository(EventEntity).findOneOrFail({
      where: { id },
      relations: { starterTemplates: true },
    });
  }

  async function counts() {
    return {
      events: await database.getRepository(EventEntity).count(),
      templates: await database
        .getRepository(EventStarterTemplateEntity)
        .count(),
      roles: await database.getRepository(UserRoleEntity).count(),
    };
  }

  it("creates an event from the default preset with only a name", async () => {
    const { body } = await create({ name: "Spring Cup" }).expect(201);
    expect(body).toMatchObject({ id: expect.any(String), name: "Spring Cup" });
    expect(body).not.toHaveProperty("githubOrgSecret");
    expect(body).not.toHaveProperty("githubInstallationId");

    const event = await load(body.id);
    expect(event).toMatchObject({
      name: "Spring Cup",
      description: "From the preset",
      location: "",
      minTeamSize: 1,
      maxTeamSize: 4,
      gameServerDockerImage: PRESET_SETTINGS.gameServerDockerImage,
      myCoreBotDockerImage: PRESET_SETTINGS.myCoreBotDockerImage,
      visualizerDockerImage: PRESET_SETTINGS.visualizerDockerImage,
      monorepoUrl: PRESET_SETTINGS.monorepoUrl,
      monorepoVersion: "dev",
      basePath: "bots/c/bot",
      gameConfig: PRESET_SETTINGS.gameConfig,
      serverConfig: PRESET_SETTINGS.serverConfig,
      introEnabled: false,
      introLeadMinutes: 15,
      streamUrl: null,
      isPrivate: true,
      presetId: defaultPreset.id,
      presetVersion: 3,
      githubInstallationId: installation.id,
      githubOrg: "core-org",
    });
    // Seven days ahead at 10:00 in Berlin, deadline 48h and end 50h later.
    const start = event.startDate.getTime();
    expect(berlinTime(start)).toBe("10:00");
    expect(start - Date.now()).toBeGreaterThan(6 * 24 * HOUR);
    expect(start - Date.now()).toBeLessThan(8 * 24 * HOUR);
    expect(event.submissionDeadline.getTime() - start).toBe(48 * HOUR);
    expect(event.scheduledEndDate.getTime() - start).toBe(50 * HOUR);
    expect(event.endDate.getTime()).toBe(event.scheduledEndDate.getTime());
    expect(
      event.starterTemplates.map(
        ({ name, basePath, myCoreBotDockerImage }) => ({
          name,
          basePath,
          myCoreBotDockerImage,
        }),
      ),
    ).toEqual([TEMPLATE]);
    expect(
      await database
        .getRepository(UserRoleEntity)
        .findOneBy({ eventId: event.id }),
    ).toMatchObject({
      userId: creatorId,
      role: UserRole.ADMIN,
      grantedById: creatorId,
    });
  });

  it("applies overrides to a named preset", async () => {
    const startDate = Date.parse("2030-05-01T08:00:00Z");
    const { body } = await create({
      presetId: otherPreset.id,
      location: "Heilbronn",
      minTeamSize: 2,
      startDate,
      submissionDeadline: startDate + HOUR,
      scheduledEndDate: startDate + 2 * HOUR,
      endDate: startDate + 3 * HOUR,
      streamUrl: "https://stream.example.com",
      starterTemplates: [],
      githubInstallationId: null,
      isPrivate: false,
    }).expect(201);
    const event = await load(body.id);
    expect(event).toMatchObject({
      location: "Heilbronn",
      minTeamSize: 2,
      maxTeamSize: 6,
      startDate: new Date(startDate),
      submissionDeadline: new Date(startDate + HOUR),
      scheduledEndDate: new Date(startDate + 2 * HOUR),
      endDate: new Date(startDate + 3 * HOUR),
      streamUrl: "https://stream.example.com",
      isPrivate: true,
      presetId: otherPreset.id,
      presetVersion: 1,
      githubInstallationId: null,
      githubOrg: "",
      starterTemplates: [],
    });
  });

  it("replaces the preset's templates and installation", async () => {
    const other = await database.getRepository(GithubInstallationEntity).save({
      installationId: 78,
      accountId: 6,
      accountLogin: "arena-org",
      accountType: "Organization",
      sharedAt: new Date(),
    });
    const template = { ...TEMPLATE, name: "TS bot", basePath: "bots/ts/bot" };
    const { body } = await create({
      starterTemplates: [template],
      githubInstallationId: other.id,
    }).expect(201);
    const event = await load(body.id);
    expect(event).toMatchObject({
      githubInstallationId: other.id,
      githubOrg: "arena-org",
    });
    expect(event.starterTemplates.map(({ name }) => name)).toEqual(["TS bot"]);
  });

  it.each([
    [
      "the organizer token",
      { githubOrg: "org", githubOrgSecret: "token" },
      400,
    ],
    ["an unknown preset", { presetId: randomUUID() }, 404],
    ["an invalid override", { maxTeamSize: 0 }, 400],
    ["a deadline before the start", { submissionDeadline: 0 }, 400],
    ["an unknown installation", { githubInstallationId: randomUUID() }, 400],
  ])("refuses %s and creates nothing", async (_, body, status) => {
    const before = await counts();
    await create(body).expect(status);
    expect(await counts()).toEqual(before);
  });

  it("refuses an archived preset with 404", async () => {
    const archived = await database
      .getRepository(EventPresetEntity)
      .findOneByOrFail({ name: "Archived" });
    await create({ presetId: archived.id }).expect(404);
    await http()
      .get(`/event-presets/${archived.id}/resolved`)
      .set("x-test-user", creatorId)
      .expect(404);
  });

  it("checks ownership for every unshared installation at create time", async () => {
    const unshared = await database
      .getRepository(GithubInstallationEntity)
      .save({
        installationId: 79,
        accountId: 7,
        accountLogin: "private-org",
        accountType: "Organization",
      });
    const before = await counts();
    await create({ githubInstallationId: unshared.id }).expect(403);
    expect(await counts()).toEqual(before);
    owner = true;
    try {
      const { body } = await create({
        githubInstallationId: unshared.id,
      }).expect(201);
      expect(await load(body.id)).toMatchObject({
        githubInstallationId: unshared.id,
      });
    } finally {
      owner = false;
    }
    await create({ githubInstallationId: unshared.id }).expect(403);
  });

  it.each(["suspendedAt", "deletedAt"] as const)(
    "refuses a shared installation with %s",
    async (field) => {
      const rows = database.getRepository(GithubInstallationEntity);
      await rows.update(installation.id, { [field]: new Date() });
      try {
        const before = await counts();
        await create({ githubInstallationId: installation.id }).expect(400);
        expect(await counts()).toEqual(before);
      } finally {
        await rows.update(installation.id, { [field]: null });
      }
    },
  );

  it("returns 400 when GitHub reports an unshared installation was uninstalled", async () => {
    const row = await database.getRepository(GithubInstallationEntity).save({
      installationId: 81,
      accountId: 7,
      accountLogin: "gone",
      accountType: "Organization",
    });
    appAuth.getInstallation.mockRejectedValueOnce(
      new GithubAppRequestError(404, "Not found"),
    );
    await create({ githubInstallationId: row.id }).expect(400);
  });

  it("shifts derived dates when only the start date changes", async () => {
    const startDate = Date.parse("2031-05-01T08:00:00Z");
    const { body } = await create({ startDate }).expect(201);
    expect(await load(body.id)).toMatchObject({
      startDate: new Date(startDate),
      submissionDeadline: new Date(startDate + 48 * HOUR),
      scheduledEndDate: new Date(startDate + 50 * HOUR),
      endDate: new Date(startDate + 50 * HOUR),
      repoLockDate: new Date(startDate + 48 * HOUR),
    });
    const explicit = startDate + 4 * HOUR;
    const changed = (
      await create({ startDate, submissionDeadline: explicit }).expect(201)
    ).body;
    expect(await load(changed.id)).toMatchObject({
      submissionDeadline: new Date(explicit),
      scheduledEndDate: new Date(startDate + 50 * HOUR),
    });
  });

  it("rolls the event and its templates back when a later insert fails", async () => {
    // The creator's ADMIN role is inserted after the event and its templates.
    await database.query(
      `ALTER TABLE "${schema}".user_roles ADD CONSTRAINT test_reject_admin CHECK ("eventId" IS NULL) NOT VALID`,
    );
    try {
      const before = await counts();
      await create({}).expect(500);
      expect(await counts()).toEqual(before);
    } finally {
      await database.query(
        `ALTER TABLE "${schema}".user_roles DROP CONSTRAINT test_reject_admin`,
      );
    }
  });

  it("answers 400 without a default preset", async () => {
    const presets = database.getRepository(EventPresetEntity);
    await presets.update(defaultPreset.id, { isDefault: false });
    try {
      const { body } = await create({}).expect(400);
      expect(body.message).toMatch("no default preset");
      await create({ presetId: otherPreset.id }).expect(201);
    } finally {
      await presets.update(defaultPreset.id, { isDefault: true });
    }
  });

  it("shows the preset on the event, which keeps its copied values", async () => {
    const { body: created } = await create({}).expect(201);
    const presets = database.getRepository(EventPresetEntity);
    await presets.update(defaultPreset.id, {
      name: "Renamed default",
      version: 4,
      settings: { ...PRESET_SETTINGS, maxTeamSize: 9 },
    });
    try {
      const { body } = await http()
        .get(`/event/${created.id}`)
        .set("x-test-user", creatorId)
        .expect(200);
      expect(body).toMatchObject({
        preset: { id: defaultPreset.id, name: "Renamed default" },
        presetVersion: 3,
        maxTeamSize: 4,
      });
      expect(Object.keys(body.preset)).toEqual(["id", "name"]);
      expect(body).not.toHaveProperty("presetId");
    } finally {
      await presets.update(defaultPreset.id, {
        name: "Default",
        version: 3,
        settings: { ...PRESET_SETTINGS, description: "From the preset" },
      });
    }

    const plain = await database.getRepository(EventEntity).save({
      name: randomUUID(),
      githubOrg: "",
      minTeamSize: 1,
      maxTeamSize: 4,
      startDate: new Date("2099-01-01"),
      submissionDeadline: new Date("2099-01-02"),
      scheduledEndDate: new Date("2099-01-02"),
      endDate: new Date("2099-01-02"),
    });
    const { body } = await http()
      .get(`/event/${plain.id}`)
      .set("x-test-user", creatorId)
      .expect(200);
    expect(body).toMatchObject({ preset: null, presetVersion: null });
  });

  it("lists the presets organizers can pick, the default first", async () => {
    const { body } = await http()
      .get("/event-presets")
      .set("x-test-user", creatorId)
      .expect(200);
    expect(body).toEqual([
      {
        id: defaultPreset.id,
        name: "Default",
        description: null,
        isDefault: true,
        version: 3,
        updatedAt: expect.any(String),
      },
      {
        id: otherPreset.id,
        name: "Arena",
        description: null,
        isDefault: false,
        version: 1,
        updatedAt: expect.any(String),
      },
    ]);
  });

  it("resolves a preset for the create form", async () => {
    const { body } = await http()
      .get(`/event-presets/${defaultPreset.id}/resolved`)
      .set("x-test-user", creatorId)
      .expect(200);
    const settings = { ...PRESET_SETTINGS, schedule: undefined };
    expect(body).toEqual({
      presetId: defaultPreset.id,
      presetVersion: 3,
      values: {
        ...settings,
        description: "From the preset",
        location: "",
        introEnabled: false,
        introLeadMinutes: 15,
        streamUrl: "",
        showtimeStreamUrl: "",
        startDate: expect.any(Number),
        submissionDeadline: expect.any(Number),
        scheduledEndDate: expect.any(Number),
        endDate: expect.any(Number),
      },
      starterTemplates: [TEMPLATE],
      githubInstallation: { id: installation.id, accountLogin: "core-org" },
      warnings: [],
    });
    expect(berlinTime(body.values.startDate)).toBe("10:00");
    expect(body.values.submissionDeadline - body.values.startDate).toBe(
      48 * HOUR,
    );
  });

  it.each([
    ["no longer shared", { sharedAt: null }],
    ["suspended", { suspendedAt: new Date() }],
    ["uninstalled", { deletedAt: new Date() }],
  ])(
    "drops and warns about a preset's installation once it is %s",
    async (_state, change) => {
      const installations = database.getRepository(GithubInstallationEntity);
      await installations.update(installation.id, change);
      try {
        const { body } = await http()
          .get(`/event-presets/${defaultPreset.id}/resolved`)
          .set("x-test-user", creatorId)
          .expect(200);
        expect(body.githubInstallation).toBeNull();
        expect(body.warnings).toEqual([
          "This preset's GitHub installation core-org is no longer available; the event will be created without one.",
        ]);
        const { body: created } = await create({}).expect(201);
        expect(await load(created.id)).toMatchObject({
          githubInstallationId: null,
          githubOrg: "",
        });
      } finally {
        await installations.update(installation.id, {
          sharedAt: new Date(),
          suspendedAt: null,
          deletedAt: null,
        });
      }
    },
  );
});
