// match.service imports the application bootstrap for its queue config.
jest.mock("../main", () => ({ getRabbitmqConfig: jest.fn() }));

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { HttpAdapterHost, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import {
  authzTestingModule,
  createAuthorizationService,
} from "../authz/testing";
import { AllExceptionsFilter } from "../common/AllExceptionsFilter";
import { TypeormExceptionFilter } from "../common/TypeormExceptionFilter";
import {
  MatchEntity,
  MatchPhase,
  MatchState,
} from "../match/entites/match.entity";
import { MatchStatsEntity } from "../match/entites/matchStats.entity";
import { MatchController } from "../match/match.controller";
import { MatchService } from "../match/match.service";
import { TeamEntity } from "../team/entities/team.entity";
import { TeamController } from "../team/team.controller";
import { TeamService } from "../team/team.service";
import {
  SocialAccountEntity,
  SocialPlatform,
} from "../user/entities/social-account.entity";
import { UserRole, UserRoleEntity } from "../user/entities/user-role.entity";
import { UserEntity } from "../user/entities/user.entity";
import { UserService } from "../user/user.service";
import { CheckController } from "./check.controller";
import { EventStarterTemplateEntity } from "./entities/event-starter-template.entity";
import {
  EventWhitelistEntity,
  WhitelistPlatform,
} from "./entities/event-whitelist.entity";
import { EventEntity } from "./entities/event.entity";
import { EventController } from "./event.controller";
import { EventService } from "./event.service";

// A dedicated test database is required; each run owns only its random schema.
const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

const PERSONAS = [
  "guest",
  "unrelated user",
  "moderator of another event",
  "participant",
  "team member",
  "whitelisted GitHub user",
  "whitelisted 42 user",
  "event moderator",
  "event admin",
  "global moderator",
  "global admin",
] as const;
type Persona = (typeof PERSONAS)[number];
// Who sees the private event; everyone sees the public one.
const SEES_PRIVATE_EVENT: Persona[] = [
  "participant",
  "team member",
  "whitelisted GitHub user",
  "whitelisted 42 user",
  "event moderator",
  "event admin",
  "global moderator",
  "global admin",
];

interface Fixture {
  event: EventEntity;
  team: TeamEntity;
  match: MatchEntity;
}

postgres("private event visibility (PostgreSQL)", () => {
  const schema = `visibility_test_${randomUUID().replaceAll("-", "")}`;
  let database: DataSource;
  let app: INestApplication;
  const users = {} as Record<Exclude<Persona, "guest">, UserEntity>;
  let privateEvent: Fixture;
  let publicEvent: Fixture;

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

    const authorization = await createAuthorizationService(database);
    const eventService = new EventService(
      database.getRepository(EventEntity),
      database.getRepository(UserRoleEntity),
      database.getRepository(EventStarterTemplateEntity),
      database.getRepository(EventWhitelistEntity),
      {} as never,
      {} as never,
      database,
    );
    const matchService = Object.create(MatchService.prototype) as MatchService;
    const teamService = new TeamService(
      database.getRepository(TeamEntity),
      {} as never,
      {} as never,
      eventService,
      matchService,
      database,
      authorization,
    );
    Object.assign(eventService, { teamService });
    // The constructor opens queue clients; the read paths never use them.
    Object.assign(matchService, {
      teamService,
      eventService,
      authorization,
      matchRepository: database.getRepository(MatchEntity),
      matchStatsRepository: database.getRepository(MatchStatsEntity),
      dataSource: database,
    });
    const userService = new UserService(
      database.getRepository(UserEntity),
      {} as never,
    );

    const moduleRef = await Test.createTestingModule({
      imports: [
        authzTestingModule(
          (id) =>
            database.getRepository(UserEntity).findOne({
              where: { id },
              relations: { roles: true },
            }),
          database,
        ),
      ],
      controllers: [
        EventController,
        CheckController,
        TeamController,
        MatchController,
      ],
      providers: [
        { provide: EventService, useValue: eventService },
        { provide: TeamService, useValue: teamService },
        { provide: MatchService, useValue: matchService },
        { provide: UserService, useValue: userService },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    // Same global setup as main.ts.
    app.useGlobalPipes(new ValidationPipe());
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
    );
    app.useGlobalFilters(
      new AllExceptionsFilter(app.get(HttpAdapterHost)),
      new TypeormExceptionFilter(),
    );
    await app.init();

    await seed();
  });

  afterAll(async () => {
    await app?.close();
    if (database?.isInitialized) {
      await database.query(`DROP SCHEMA "${schema}" CASCADE`);
      await database.destroy();
    }
  });

  async function createUser(username = `user-${randomUUID()}`) {
    const id = randomUUID();
    return database.getRepository(UserEntity).save({
      githubId: id,
      githubAccessToken: "token",
      email: `${id}@example.com`,
      username,
      name: id,
    });
  }

  async function createEvent(isPrivate: boolean) {
    return database.getRepository(EventEntity).save({
      name: randomUUID().slice(0, 30),
      githubOrg: "org",
      githubOrgSecret: "secret",
      isPrivate,
      gameServerDockerImage: "server:1",
      myCoreBotDockerImage: "bot:1",
      visualizerDockerImage: "visualizer:1",
      minTeamSize: 1,
      maxTeamSize: 4,
      startDate: new Date("2099-01-01"),
      submissionDeadline: new Date("2100-01-01"),
      scheduledEndDate: new Date("2100-01-01"),
      endDate: new Date("2100-01-01"),
    });
  }

  function grant(user: UserEntity, role: UserRole, eventId: string | null) {
    return database
      .getRepository(UserRoleEntity)
      .insert({ userId: user.id, role, eventId });
  }

  function whitelist(
    event: EventEntity,
    username: string,
    platform: WhitelistPlatform,
  ) {
    return database.getRepository(EventWhitelistEntity).save({
      event: { id: event.id },
      username,
      platform,
    });
  }

  function enrol(event: EventEntity, user: UserEntity) {
    return database
      .createQueryBuilder()
      .relation(UserEntity, "events")
      .of(user.id)
      .add(event.id);
  }

  // An event with every persona's link to it, a team and a finished match.
  async function createFixture(isPrivate: boolean): Promise<Fixture> {
    const event = await createEvent(isPrivate);
    await enrol(event, users.participant);
    await whitelist(
      event,
      users["whitelisted GitHub user"].username.toLowerCase(),
      WhitelistPlatform.GITHUB,
    );
    await whitelist(event, "forty-two", WhitelistPlatform.FORTYTWO);
    await grant(users["event moderator"], UserRole.MODERATOR, event.id);
    await grant(users["event admin"], UserRole.ADMIN, event.id);
    const team = await database.getRepository(TeamEntity).save({
      name: randomUUID().slice(0, 20),
      event: { id: event.id },
      users: [users["team member"]],
    });
    const opponent = await database.getRepository(TeamEntity).save({
      name: randomUUID().slice(0, 20),
      event: { id: event.id },
    });
    const match = await database.getRepository(MatchEntity).save({
      phase: MatchPhase.QUEUE,
      round: 0,
      state: MatchState.FINISHED,
      teams: [{ id: team.id }, { id: opponent.id }],
      winner: { id: team.id },
      stats: new MatchStatsEntity(),
    });
    return { event, team, match };
  }

  async function seed() {
    for (const persona of PERSONAS)
      if (persona !== "guest")
        users[persona] = await createUser(
          // Whitelist entries are lowercase; the GitHub login need not be.
          persona === "whitelisted GitHub user"
            ? `Mixed-${randomUUID()}`
            : undefined,
        );
    await database.getRepository(SocialAccountEntity).save({
      userId: users["whitelisted 42 user"].id,
      platform: SocialPlatform.FORTYTWO,
      username: "Forty-Two",
      platformUserId: randomUUID(),
    });
    await grant(users["global moderator"], UserRole.MODERATOR, null);
    await grant(users["global admin"], UserRole.ADMIN, null);
    const otherEvent = await createEvent(true);
    await grant(
      users["moderator of another event"],
      UserRole.MODERATOR,
      otherEvent.id,
    );

    privateEvent = await createFixture(true);
    publicEvent = await createFixture(false);
  }

  function get(path: string, persona: Persona) {
    const req = request(app.getHttpServer()).get(path);
    return persona === "guest"
      ? req
      : req.set("x-test-user", users[persona].id);
  }

  const ROUTES: {
    path: (fixture: Fixture) => string;
    signedIn?: boolean;
  }[] = [
    { path: ({ event }) => `/event/${event.id}` },
    { path: ({ event }) => `/event/${event.id}/version` },
    { path: ({ event }) => `/event/${event.id}/game-config` },
    { path: ({ event }) => `/event/${event.id}/github-org` },
    { path: ({ event }) => `/event/${event.id}/teamsCount` },
    { path: ({ event }) => `/event/${event.id}/participantsCount` },
    { path: ({ event }) => `/check/${event.id}` },
    { path: ({ event }) => `/match/tournament/${event.id}/teamCount` },
    { path: ({ team }) => `/team/${team.id}` },
    { path: ({ team }) => `/team/${team.id}/members` },
    { path: ({ event }) => `/event/${event.id}/templates`, signedIn: true },
    { path: ({ event }) => `/team/event/${event.id}`, signedIn: true },
    { path: ({ event }) => `/match/swiss/${event.id}`, signedIn: true },
    { path: ({ match }) => `/match/${match.id}`, signedIn: true },
    { path: ({ team }) => `/match/team/${team.id}`, signedIn: true },
  ];

  // Every route answers a hidden event like an unknown id; the public event
  // stays open to everyone the route lets in.
  it.each(PERSONAS)(
    "shows a %s exactly the events they may see",
    async (persona) => {
      const answers: string[] = [];
      const expected: string[] = [];
      for (const route of ROUTES)
        for (const fixture of [privateEvent, publicEvent]) {
          const isPrivate = fixture === privateEvent;
          const path = route.path(fixture);
          const kind = isPrivate ? "private" : "public";
          answers.push(`${kind} ${path} ${(await get(path, persona)).status}`);
          expected.push(
            `${kind} ${path} ${
              route.signedIn && persona === "guest"
                ? 401
                : !isPrivate || SEES_PRIVATE_EVENT.includes(persona)
                  ? 200
                  : 404
            }`,
          );
        }
      expect(answers).toEqual(expected);
    },
  );

  // The timestamp and path differ per request; the rest must not.
  const shape = (body: Record<string, unknown>) => ({
    keys: Object.keys(body).sort(),
    statusCode: body.statusCode,
    message: body.message,
  });

  it.each(["guest", "unrelated user"] as const)(
    "answers a %s about a hidden event, team or match exactly like an unknown id",
    async (persona) => {
      const { event, team, match } = privateEvent;
      for (const [hidden, unknown] of [
        [`/event/${event.id}`, `/event/${randomUUID()}`],
        [`/event/${event.id}/version`, `/event/${randomUUID()}/version`],
        [`/team/${team.id}`, `/team/${randomUUID()}`],
        [`/team/${team.id}/members`, `/team/${randomUUID()}/members`],
        ...(persona === "guest"
          ? []
          : [
              [`/match/${match.id}`, `/match/${randomUUID()}`],
              [`/match/team/${team.id}`, `/match/team/${randomUUID()}`],
            ]),
      ]) {
        const [a, b] = [
          await get(hidden, persona),
          await get(unknown, persona),
        ];
        expect(a.status).toBe(404);
        expect(shape(a.body)).toEqual(shape(b.body));
      }
    },
  );

  it("lets a whitelisted user join a private event and nobody else", async () => {
    const event = await createEvent(true);
    const [invited, outsider] = [await createUser(), await createUser()];
    await whitelist(event, invited.username, WhitelistPlatform.GITHUB);
    const join = (user: UserEntity) =>
      request(app.getHttpServer())
        .put(`/event/${event.id}/join`)
        .set("x-test-user", user.id);

    await join(outsider).expect(404);
    await join(invited).expect(200);
    await join(invited).expect(400, /already registered/);
    expect(
      await database.getRepository(UserEntity).existsBy({
        id: invited.id,
        events: { id: event.id },
      }),
    ).toBe(true);
  });

  it("no longer shows a private event to the members of a deleted team", async () => {
    const event = await createEvent(true);
    const member = await createUser();
    const team = await database.getRepository(TeamEntity).save({
      name: randomUUID().slice(0, 20),
      event: { id: event.id },
      users: [member],
    });
    const asMember = (path: string) =>
      request(app.getHttpServer()).get(path).set("x-test-user", member.id);
    await asMember(`/event/${event.id}`).expect(200);
    await database.getRepository(TeamEntity).softDelete(team.id);
    await asMember(`/event/${event.id}`).expect(404);
  });

  it("lists private events only in the overview of those taking part", async () => {
    const ids = (events: { id: string }[]) => events.map((event) => event.id);
    const listed = await get("/event", "participant").expect(200);
    expect(ids(listed.body)).toContain(publicEvent.event.id);
    expect(ids(listed.body)).not.toContain(privateEvent.event.id);

    const mine = await get("/event/overview", "participant").expect(200);
    expect(ids(mine.body.allEvents)).not.toContain(privateEvent.event.id);
    expect(ids(mine.body.myEvents)).toContain(privateEvent.event.id);
    const theirs = await get("/event/overview", "unrelated user").expect(200);
    expect([
      ...ids(theirs.body.allEvents),
      ...ids(theirs.body.myEvents),
    ]).not.toContain(privateEvent.event.id);
  });
});
