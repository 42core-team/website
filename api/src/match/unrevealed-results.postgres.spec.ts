// match.service imports the application bootstrap for its queue config.
jest.mock("../main", () => ({ getRabbitmqConfig: jest.fn() }));

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  ClassSerializerInterceptor,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from "@nestjs/common";
import { HttpAdapterHost, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AllExceptionsFilter } from "../common/AllExceptionsFilter";
import { TypeormExceptionFilter } from "../common/TypeormExceptionFilter";
import { EventEntity } from "../event/entities/event.entity";
import { EventService } from "../event/event.service";
import { TeamEntity } from "../team/entities/team.entity";
import { TeamController } from "../team/team.controller";
import { TeamService } from "../team/team.service";
import {
  PermissionRole,
  UserEntity,
  UserEventPermissionEntity,
} from "../user/entities/user.entity";
import { UserService } from "../user/user.service";
import { MatchEntity, MatchPhase, MatchState } from "./entites/match.entity";
import { MatchStatsEntity } from "./entites/matchStats.entity";
import { MatchController } from "./match.controller";
import { MatchService } from "./match.service";
import { StatsController } from "../stats/stats.controller";

// A dedicated test database is required; each run owns only its random schema.
const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

const HIDDEN_ACTIONS = 918273;
const HIDDEN_DAMAGE = 564738;
const QUEUE_ACTIONS = 4321;
// Stored Buchholz values that no revealed-only calculation can produce.
const STORED_BUCHHOLZ = { A: 31, B: 32, C: 33, D: 34 };
const MATCH_FIELDS_HIDDEN_WHEN_UNREVEALED = [
  "id",
  "stats",
  "winner",
  "results",
  "updatedAt",
];
const MATCH_TEAM_KEYS = ["background", "deletedAt", "id", "name", "picture"];
// Team fields that are never part of a team response.
const TEAM_FIELDS_NEVER_RETURNED = [
  "updatedAt",
  "deletedAt",
  "locked",
  "eventId",
  "repositoryOperationId",
  "lastCreditGrantedAt",
  "startedRepoCreationAt",
];
const PUBLIC_TEAM_LIST_KEYS = [
  "buchholzPoints",
  "createdAt",
  "hadBye",
  "id",
  "name",
  "picture",
  "score",
  "tags",
  "userCount",
];

// Response bodies are untyped JSON.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

postgres("unrevealed match results (PostgreSQL)", () => {
  const schema = `reveal_test_${randomUUID().replaceAll("-", "")}`;
  let database: DataSource;
  let app: INestApplication;
  let event: EventEntity;
  const teams: Record<"A" | "B" | "C" | "D", TeamEntity> = {} as never;
  const users: Record<
    "member" | "opponent" | "invitee" | "admin" | "outsider",
    UserEntity
  > = {} as never;
  // m1/m2 are revealed round 0 results, m3 is A beating C in round 1 and
  // finished but not revealed yet.
  const matches: Record<
    "m1" | "m2" | "m3" | "e1" | "e2" | "queue",
    MatchEntity
  > = {} as never;

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
      database.getRepository(UserEventPermissionEntity),
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      database,
    );
    const matchService = Object.create(MatchService.prototype) as MatchService;
    const teamService = new TeamService(
      database.getRepository(TeamEntity),
      {} as never,
      eventService,
      matchService,
      database,
      {
        rosterWillChange: async () => {},
        rosterChanged: async () => {},
      } as never,
    );
    // The constructor opens queue clients; the read paths never use them.
    Object.assign(matchService, {
      teamService,
      eventService,
      matchRepository: database.getRepository(MatchEntity),
      matchStatsRepository: database.getRepository(MatchStatsEntity),
      dataSource: database,
      // Nothing listens here, so log lookups find no containers.
      k8sServiceUrl: "http://127.0.0.1:9",
      logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn() },
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [MatchController, TeamController, StatsController],
      providers: [
        { provide: MatchService, useValue: matchService },
        { provide: TeamService, useValue: teamService },
        { provide: EventService, useValue: eventService },
        { provide: UserService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          const userId = req.headers["x-test-user"];
          if (!userId) throw new UnauthorizedException();
          req.user = { id: userId };
          return true;
        },
      })
      .compile();
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

  async function seed() {
    for (const key of [
      "member",
      "opponent",
      "invitee",
      "admin",
      "outsider",
    ] as const)
      users[key] = await createUser();

    event = await database.getRepository(EventEntity).save({
      name: randomUUID().slice(0, 30),
      githubOrg: "org",
      githubOrgSecret: "secret",
      minTeamSize: 1,
      maxTeamSize: 4,
      startDate: new Date("2020-01-01"),
      submissionDeadline: new Date("2020-02-01"),
      scheduledEndDate: new Date("2099-01-01"),
      endDate: new Date("2099-01-01"),
      currentRound: 2,
    });
    await database.getRepository(UserEventPermissionEntity).save({
      user: { id: users.admin.id },
      event: { id: event.id },
      role: PermissionRole.ADMIN,
    });

    // Stored scores already include the unrevealed m3 win of A.
    const stored = { A: 2, B: 0, C: 1, D: 0 };
    for (const key of ["A", "B", "C", "D"] as const) {
      teams[key] = await database.getRepository(TeamEntity).save({
        name: `Team ${key}`,
        event: { id: event.id },
        repo: `repo-${key}`,
        credits: 9,
        score: stored[key],
        buchholzPoints: STORED_BUCHHOLZ[key],
        users:
          key === "A" ? [users.member] : key === "B" ? [users.opponent] : [],
        teamInvites: key === "C" ? [users.invitee] : [],
      });
    }

    matches.m1 = await createMatch(MatchPhase.SWISS, 0, ["A", "B"], "A", true);
    matches.m2 = await createMatch(MatchPhase.SWISS, 0, ["C", "D"], "C", true);
    matches.m3 = await createMatch(
      MatchPhase.SWISS,
      1,
      ["A", "C"],
      "A",
      false,
      { actionsExecuted: HIDDEN_ACTIONS, damageTotal: HIDDEN_DAMAGE },
    );
    matches.e1 = await createMatch(
      MatchPhase.ELIMINATION,
      0,
      ["A", "C"],
      "A",
      true,
    );
    matches.e2 = await createMatch(
      MatchPhase.ELIMINATION,
      0,
      ["B", "D"],
      "D",
      false,
      { actionsExecuted: HIDDEN_ACTIONS, damageTotal: HIDDEN_DAMAGE },
    );
    matches.queue = await createMatch(
      MatchPhase.QUEUE,
      0,
      ["A", "B"],
      "B",
      false,
      { actionsExecuted: QUEUE_ACTIONS },
    );
  }

  async function createMatch(
    phase: MatchPhase,
    round: number,
    teamKeys: ("A" | "B" | "C" | "D")[],
    winnerKey: "A" | "B" | "C" | "D",
    isRevealed: boolean,
    stats: Partial<MatchStatsEntity> = {},
  ) {
    const winner = teams[winnerKey];
    const saved = await database.getRepository(MatchEntity).save({
      phase,
      round,
      state: MatchState.FINISHED,
      isRevealed,
      teams: teamKeys.map((key) => ({ id: teams[key].id })),
      winner: { id: winner.id },
      stats: Object.assign(new MatchStatsEntity(), stats),
      results: teamKeys.map((key) => ({
        team: { id: teams[key].id },
        score: teams[key].score,
      })),
    });
    return database.getRepository(MatchEntity).findOneByOrFail({
      id: saved.id,
    });
  }

  function get(path: string, userId?: string) {
    const req = request(app.getHttpServer()).get(path);
    return userId ? req.set("x-test-user", userId) : req;
  }

  function put(path: string, userId: string) {
    return request(app.getHttpServer()).put(path).set("x-test-user", userId);
  }

  // Error bodies differ only in their timestamp and the id in their path.
  function errorBody(response: request.Response, id: string) {
    const { timestamp, ...body } = response.body as Json;
    expect(typeof timestamp).toBe("string");
    return { ...body, path: String(body.path).replace(id, ":id") };
  }

  async function expectAnsweredLikeUnknown(
    send: (id: string) => Promise<request.Response>,
    hiddenIds: string[],
  ) {
    const unknownId = randomUUID();
    const unknown = await send(unknownId);
    expect(unknown.status).toBe(404);
    for (const id of hiddenIds) {
      const response = await send(id);
      expect(response.status).toBe(unknown.status);
      expect(errorBody(response, id)).toEqual(errorBody(unknown, unknownId));
    }
  }

  function findById(list: Json[], id: string) {
    return list.find((match) => match.id === id);
  }

  // Hidden matches have neither an id nor teams; in this fixture each is the
  // only hidden match of its phase and round.
  function findHidden(list: Json[], match: MatchEntity) {
    const hidden = list.filter(
      (entry) =>
        !("id" in entry) &&
        entry.round === match.round &&
        entry.phase === match.phase,
    );
    expect(hidden).toHaveLength(1);
    return hidden[0];
  }

  function expectHiddenMatch(entry: Json | undefined) {
    expect(entry).toBeDefined();
    for (const field of MATCH_FIELDS_HIDDEN_WHEN_UNREVEALED)
      expect(entry).not.toHaveProperty(field);
    expect(entry!.state).toBe(MatchState.PLANNED);
    expect(entry!.isRevealed).toBe(false);
    // The pairing of a later round would reveal the earlier results.
    expect(entry!.teams).toEqual([]);
  }

  function expectNoHiddenData(body: unknown) {
    const json = JSON.stringify(body);
    expect(json).not.toContain(matches.m3.id);
    expect(json).not.toContain(matches.e2.id);
    expect(json).not.toContain(String(HIDDEN_ACTIONS));
    expect(json).not.toContain(String(HIDDEN_DAMAGE));
    expect(json).not.toContain('"buchholzPoints"');
    expect(json).not.toContain('"credits"');
  }

  function expectMatchTeamsIdentityOnly(list: Json[]) {
    for (const match of list) {
      for (const team of match.teams)
        expect(Object.keys(team).sort()).toEqual(MATCH_TEAM_KEYS);
      if (match.winner)
        expect(Object.keys(match.winner).sort()).toEqual(MATCH_TEAM_KEYS);
      for (const result of match.results ?? [])
        expect(Object.keys(result.team).sort()).toEqual(MATCH_TEAM_KEYS);
    }
  }

  async function swiss(userId: string, adminReveal = false) {
    const query = adminReveal ? "?adminRevealQuery=true" : "";
    const response = await get(`/match/swiss/${event.id}${query}`, userId);
    expect(response.status).toBe(200);
    return response.body as Json[];
  }

  async function tournament(userId: string, adminReveal = false) {
    const query = adminReveal ? "?adminRevealQuery=true" : "";
    const response = await get(`/match/tournament/${event.id}${query}`, userId);
    expect(response.status).toBe(200);
    return response.body as Json[];
  }

  async function teamList(userId: string, adminReveal = false) {
    const response = await get(
      `/team/event/${event.id}?sortBy=score&sortDir=desc&adminRevealQuery=${adminReveal}`,
      userId,
    );
    expect(response.status).toBe(200);
    return response.body as Json[];
  }

  function expectTeamFields(team: Json, keys: string[]) {
    expect(Object.keys(team).sort()).toEqual([...keys].sort());
    for (const field of TEAM_FIELDS_NEVER_RETURNED)
      expect(team).not.toHaveProperty(field);
  }

  // The cached totals are refreshed by a cron job, which does not run here.
  async function globalStats() {
    await app.get(StatsController).updateGlobalStats();
    const response = await get("/stats/global");
    expect(response.status).toBe(200);
    return response.body as Json;
  }

  function standings(list: Json[]) {
    return Object.fromEntries(
      list.map((team) => [
        team.name,
        { score: team.score, buchholzPoints: team.buchholzPoints },
      ]),
    );
  }

  describe("before the hidden match is revealed", () => {
    it("gives the anonymous team profile identity and artwork only", async () => {
      const response = await get(`/team/${teams.A.id}`);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: teams.A.id,
        name: "Team A",
        tags: [],
      });
      expectTeamFields(response.body, [
        "background",
        "id",
        "name",
        "picture",
        "tags",
      ]);
    });

    it("hides unrevealed swiss results, ids, stats and stored scores from a normal user", async () => {
      const body = await swiss(users.outsider.id);
      expect(body).toHaveLength(3);
      expectNoHiddenData(body);
      expectMatchTeamsIdentityOnly(body);
      expectHiddenMatch(findHidden(body, matches.m3));

      const revealed = findById(body, matches.m1.id)!;
      expect(revealed.winner.id).toBe(teams.A.id);
      expect(revealed.state).toBe(MatchState.FINISHED);
      expect(revealed.stats).toMatchObject({ actionsExecuted: 0 });
      expect(revealed.stats).not.toHaveProperty("id");
    });

    it("lists swiss matches by round, then creation", async () => {
      // Make creation order differ from insertion order, so the result can
      // only match when the query sorts.
      const repository = database.getRepository(MatchEntity);
      const base = matches.m1.createdAt.getTime();
      await repository.update(matches.m3.id, {
        createdAt: new Date(base - 60_000),
      });
      await repository.update(matches.m2.id, {
        createdAt: new Date(base - 30_000),
      });
      const body = await swiss(users.admin.id, true);
      expect(body.map((match) => match.id)).toEqual([
        matches.m2.id,
        matches.m1.id,
        matches.m3.id,
      ]);
    });

    it("leaves unrevealed swiss and tournament matches out of the global stats", async () => {
      const body = await globalStats();
      expectNoHiddenData(body);
      // Queue matches are never hidden, so they always count.
      expect(Number(body.actionsExecuted)).toBe(QUEUE_ACTIONS);
      expect(Number(body.damageTotal)).toBe(0);
    });

    it("hides unrevealed tournament results from a normal user", async () => {
      const body = await tournament(users.outsider.id);
      expect(body).toHaveLength(2);
      expectNoHiddenData(body);
      expectMatchTeamsIdentityOnly(body);
      expectHiddenMatch(findHidden(body, matches.e2));
      expect(findById(body, matches.e1.id)?.winner.id).toBe(teams.A.id);
    });

    it("answers unknown and unrevealed match ids alike", async () => {
      await expectAnsweredLikeUnknown(
        (id) => get(`/match/${id}`, users.outsider.id),
        [matches.m3.id, matches.e2.id],
      );
    });

    it("answers logs of a match the caller is not part of like an unknown match", async () => {
      await expectAnsweredLikeUnknown(
        (id) => get(`/match/logs/${id}`, users.outsider.id),
        [matches.m1.id, matches.m3.id, matches.e2.id, matches.queue.id],
      );
      await expectAnsweredLikeUnknown(
        (id) => get(`/match/logs/${id}`, users.member.id),
        [matches.m2.id, matches.e2.id],
      );
    });

    it("keeps logs available to the match's teams and event admins", async () => {
      for (const id of [matches.m3.id, matches.queue.id]) {
        expect((await get(`/match/logs/${id}`, users.member.id)).status).toBe(
          200,
        );
        expect((await get(`/match/logs/${id}`, users.admin.id)).status).toBe(
          200,
        );
      }
    });

    it("answers a reveal by a non-admin like an unknown match", async () => {
      for (const userId of [users.outsider.id, users.member.id])
        await expectAnsweredLikeUnknown(
          (id) => put(`/match/reveal/${id}`, userId),
          [matches.m3.id, matches.e2.id, matches.m1.id],
        );
      const hidden = await database
        .getRepository(MatchEntity)
        .findOneByOrFail({ id: matches.m3.id });
      expect(hidden.isRevealed).toBe(false);
    });

    it("shows a revealed match detail without stored standings", async () => {
      const response = await get(`/match/${matches.m1.id}`, users.outsider.id);
      expect(response.status).toBe(200);
      expect(response.body.winner.id).toBe(teams.A.id);
      expectMatchTeamsIdentityOnly([response.body]);
      expect(JSON.stringify(response.body)).not.toContain('"buchholzPoints"');
    });

    it("shows a queue match to anyone who has its id, without rating scores", async () => {
      for (const userId of [users.outsider.id, users.member.id]) {
        const response = await get(`/match/${matches.queue.id}`, userId);
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          id: matches.queue.id,
          state: MatchState.FINISHED,
          winner: { id: teams.B.id },
          results: [],
          stats: { actionsExecuted: QUEUE_ACTIONS },
        });
        expect(response.body.teams).toHaveLength(2);
        expectMatchTeamsIdentityOnly([response.body]);
      }
    });

    it("pages and searches all queue matches of an event for its admins", async () => {
      const otherEvent = await database.getRepository(EventEntity).save({
        name: randomUUID().slice(0, 30),
        githubOrg: "org",
        githubOrgSecret: "secret",
        minTeamSize: 1,
        maxTeamSize: 4,
        startDate: new Date("2020-01-01"),
        submissionDeadline: new Date("2020-02-01"),
        scheduledEndDate: new Date("2099-01-01"),
        endDate: new Date("2099-01-01"),
      });
      await database.getRepository(UserEventPermissionEntity).save({
        user: { id: users.admin.id },
        event: { id: otherEvent.id },
        role: PermissionRole.ADMIN,
      });
      const saveTeam = (name: string) =>
        database.getRepository(TeamEntity).save({
          name,
          event: { id: otherEvent.id },
          repo: randomUUID(),
        });
      const [red, blue, green] = await Promise.all(
        ["Red_Team", "Blue", "RedXTeam"].map(saveTeam),
      );
      const saveMatch = async (
        playing: TeamEntity[],
        createdAt: string,
        phase = MatchPhase.QUEUE,
      ) => {
        const { id } = await database.getRepository(MatchEntity).save({
          phase,
          round: 0,
          state: MatchState.FINISHED,
          teams: playing.map(({ id: teamId }) => ({ id: teamId })),
          winner: { id: playing[0].id },
          stats: new MatchStatsEntity(),
        });
        await database
          .getRepository(MatchEntity)
          .update(id, { createdAt: new Date(createdAt) });
        return id;
      };
      const oldest = await saveMatch([red, blue], "2026-01-01");
      const middle = await saveMatch([blue, green], "2026-01-02");
      const newest = await saveMatch([red, green], "2026-01-03");
      await saveMatch([red, blue], "2026-01-04", MatchPhase.MANUAL);

      const admin = (query: string) =>
        get(`/match/queue/${otherEvent.id}/admin?${query}`, users.admin.id);
      const ids = (response: request.Response) =>
        response.body.matches.map((match: Json) => match.id);

      // Pages count matches, not the team rows they join to.
      const firstPage = await admin("pageSize=2");
      expect(firstPage.body).toMatchObject({
        total: 3,
        page: 1,
        pageSize: 2,
      });
      expect(ids(firstPage)).toEqual([newest, middle]);
      expect(ids(await admin("pageSize=2&page=2"))).toEqual([oldest]);

      // A search keeps both teams and treats wildcards literally.
      const redMatches = await admin("search=rEd");
      expect(redMatches.body.total).toBe(3);
      expect(ids(redMatches)).toEqual([newest, middle, oldest]);
      expect(redMatches.body.matches[0].teams).toHaveLength(2);
      expect(ids(await admin("search=red_"))).toEqual([newest, oldest]);
      expect((await admin("search=nobody")).body).toMatchObject({
        matches: [],
        total: 0,
      });

      // Deleted teams stay listed and searchable.
      await database.getRepository(TeamEntity).softDelete(blue.id);
      const deleted = await admin("search=blue");
      expect(ids(deleted)).toEqual([middle, oldest]);
      expect(
        deleted.body.matches[0].teams.find((team: Json) => team.id === blue.id)
          .deletedAt,
      ).toBeTruthy();

      for (const query of [
        "page=0",
        "pageSize=101",
        "page=x",
        "search=a&search=b",
        `search=${"a".repeat(31)}`,
      ])
        expect((await admin(query)).status).toBe(400);
      const outsider = await get(
        `/match/queue/${otherEvent.id}/admin`,
        users.outsider.id,
      );
      expect(outsider.status).toBe(401);
    });

    it("gives queue match ids to members of the teams that played only", async () => {
      async function teamHistory(teamKey: "A" | "B" | "C", userId: string) {
        const response = await get(`/match/team/${teams[teamKey].id}`, userId);
        expect(response.status).toBe(200);
        return response.body as Json[];
      }
      function queueEntries(list: Json[]) {
        return list.filter((match) => match.phase === MatchPhase.QUEUE);
      }

      // A team's own history leaves out its unrevealed tournament match.
      expect(
        (await teamHistory("A", users.member.id)).map((match) => match.id),
      ).not.toContain(matches.m3.id);

      // Both teams' members see the id, on either team's page.
      for (const userId of [users.member.id, users.opponent.id])
        for (const teamKey of ["A", "B"] as const) {
          const [queue] = queueEntries(await teamHistory(teamKey, userId));
          expect(queue.id).toBe(matches.queue.id);
          expect(queue.winner.id).toBe(teams.B.id);
        }
      const own = await get(`/match/queue/${event.id}`, users.member.id);
      expect(own.body.map((match: Json) => match.id)).toEqual([
        matches.queue.id,
      ]);
      const all = await get(`/match/queue/${event.id}/admin`, users.admin.id);
      expect(all.body.matches.map((match: Json) => match.id)).toEqual([
        matches.queue.id,
      ]);

      // Everyone else sees the finished queue match and its winner only.
      for (const userId of [
        users.outsider.id,
        users.invitee.id,
        users.admin.id,
      ]) {
        for (const teamKey of ["A", "B"] as const) {
          const [queue] = queueEntries(await teamHistory(teamKey, userId));
          expect(queue).not.toHaveProperty("id");
          expect(queue.winner.id).toBe(teams.B.id);
        }
      }
      const outsiderResponses = [
        await teamHistory("A", users.outsider.id),
        await teamHistory("B", users.outsider.id),
        await teamHistory("C", users.invitee.id),
        (await get(`/match/queue/${event.id}`, users.outsider.id)).body,
        await swiss(users.outsider.id),
        await tournament(users.outsider.id),
        await teamList(users.outsider.id),
        (await get(`/team/${teams.A.id}`)).body,
        (await get(`/team/event/${event.id}/pending`, users.invitee.id)).body,
      ];
      expect(JSON.stringify(outsiderResponses)).not.toContain(matches.queue.id);
    });

    it("gives the own team and pending invites no standings or timestamps", async () => {
      const my = await get(`/team/event/${event.id}/my`, users.member.id);
      expect(my.status).toBe(200);
      expect(my.body).toMatchObject({ id: teams.A.id, repo: "repo-A" });
      expectTeamFields(my.body, [
        "background",
        "id",
        "name",
        "picture",
        "repo",
        "repositoryError",
        "repositoryStatus",
        "tags",
        "tournamentExcluded",
      ]);

      const pending = await get(
        `/team/event/${event.id}/pending`,
        users.invitee.id,
      );
      expect(pending.status).toBe(200);
      expect(pending.body).toHaveLength(1);
      expect(pending.body[0]).toMatchObject({ id: teams.C.id });
      expectTeamFields(pending.body[0], ["id", "name", "tags"]);
    });

    it("does not let a non-admin switch on reveal mode", async () => {
      expect(await swiss(users.outsider.id, true)).toEqual(
        await swiss(users.outsider.id),
      );
      expect(await tournament(users.outsider.id, true)).toEqual(
        await tournament(users.outsider.id),
      );
      expect(await teamList(users.outsider.id, true)).toEqual(
        await teamList(users.outsider.id),
      );
      const response = await get(
        `/match/${matches.m3.id}?adminRevealQuery=true`,
        users.outsider.id,
      );
      expect(response.status).toBe(404);
    });

    it("gives an admin without reveal mode the public view", async () => {
      expect(await swiss(users.admin.id)).toEqual(
        await swiss(users.outsider.id),
      );
      const response = await get(`/match/${matches.m3.id}`, users.admin.id);
      expect(response.status).toBe(404);
    });

    it("gives a verified event admin in reveal mode the real results", async () => {
      const body = await swiss(users.admin.id, true);
      const hidden = findById(body, matches.m3.id)!;
      expect(hidden).toBeDefined();
      expect(hidden.isRevealed).toBe(false);
      expect(hidden.winner.id).toBe(teams.A.id);
      expect(hidden.teams.map((team: Json) => team.id).sort()).toEqual(
        [teams.A.id, teams.C.id].sort(),
      );
      expect(hidden.stats.actionsExecuted).toBe(HIDDEN_ACTIONS);
      expectMatchTeamsIdentityOnly(body);

      expect(
        findById(await tournament(users.admin.id, true), matches.e2.id)?.winner
          .id,
      ).toBe(teams.D.id);

      const detail = await get(
        `/match/${matches.m3.id}?adminRevealQuery=true`,
        users.admin.id,
      );
      expect(detail.status).toBe(200);
      expect(detail.body.winner.id).toBe(teams.A.id);
      expect(detail.body.results).toHaveLength(2);

      const adminList = await teamList(users.admin.id, true);
      for (const team of adminList)
        expectTeamFields(team, [
          ...PUBLIC_TEAM_LIST_KEYS,
          "credits",
          "queueScore",
          "repositoryError",
          "repositoryStatus",
          "tournamentExcluded",
        ]);
      expect(standings(adminList)).toEqual({
        "Team A": { score: 2, buchholzPoints: STORED_BUCHHOLZ.A },
        "Team B": { score: 0, buchholzPoints: STORED_BUCHHOLZ.B },
        "Team C": { score: 1, buchholzPoints: STORED_BUCHHOLZ.C },
        "Team D": { score: 0, buchholzPoints: STORED_BUCHHOLZ.D },
      });
    });

    it("lets an event admin sort the team list by queue score", async () => {
      const response = await get(
        `/team/event/${event.id}?sortBy=queueScore&sortDir=desc`,
        users.admin.id,
      );
      expect(response.status).toBe(200);
      // Every team has the default score here, so the names decide the order.
      expect(
        response.body.map((team: Json) => [team.name, team.queueScore]),
      ).toEqual([
        ["Team A", 1000],
        ["Team B", 1000],
        ["Team C", 1000],
        ["Team D", 1000],
      ]);
    });

    it("keeps the public team list standings and order", async () => {
      const list = await teamList(users.outsider.id);
      expect(standings(list)).toEqual({
        "Team A": { score: 1, buchholzPoints: 0 },
        "Team B": { score: 0, buchholzPoints: 1 },
        "Team C": { score: 1, buchholzPoints: 0 },
        "Team D": { score: 0, buchholzPoints: 1 },
      });
      expect(
        list
          .slice(0, 2)
          .map((team) => team.name)
          .sort(),
      ).toEqual(["Team A", "Team C"]);
      expect(list[0].userCount + list[1].userCount).toBe(1);
      for (const team of list) expectTeamFields(team, PUBLIC_TEAM_LIST_KEYS);

      const byName = await get(
        `/team/event/${event.id}?sortBy=name&sortDir=asc&searchName=team`,
        users.outsider.id,
      );
      expect(byName.body.map((team: Json) => team.name)).toEqual([
        "Team A",
        "Team B",
        "Team C",
        "Team D",
      ]);
      const buchholz = await get(
        `/team/event/${event.id}?sortBy=buchholzPoints`,
        users.outsider.id,
      );
      expect(buchholz.status).toBe(400);
      // The order alone would reveal the hidden queue scores.
      const queueScore = await get(
        `/team/event/${event.id}?sortBy=queueScore&adminRevealQuery=true`,
        users.outsider.id,
      );
      expect(queueScore.status).toBe(400);
    });

    it("does not sort the public team list by fields it leaves out", async () => {
      const unsorted = await get(`/team/event/${event.id}`, users.outsider.id);
      for (const sortBy of ["updatedAt", "locked", "credits"]) {
        const response = await get(
          `/team/event/${event.id}?sortBy=${sortBy}&sortDir=desc`,
          users.outsider.id,
        );
        expect(response.status).toBe(200);
        expect(response.body).toEqual(unsorted.body);
      }
    });
  });

  describe("after the hidden match is revealed", () => {
    beforeAll(async () => {
      const response = await put(
        `/match/reveal/${matches.m3.id}`,
        users.admin.id,
      );
      expect(response.status).toBe(200);
    });

    it("updates public standings and match details together", async () => {
      expect(standings(await teamList(users.outsider.id))).toEqual({
        "Team A": { score: 2, buchholzPoints: 1 },
        "Team B": { score: 0, buchholzPoints: 2 },
        "Team C": { score: 1, buchholzPoints: 2 },
        "Team D": { score: 0, buchholzPoints: 1 },
      });

      const revealed = findById(await swiss(users.outsider.id), matches.m3.id);
      expect(revealed?.winner.id).toBe(teams.A.id);
      expect(revealed?.stats).toMatchObject({
        actionsExecuted: HIDDEN_ACTIONS,
        damageTotal: HIDDEN_DAMAGE,
      });

      const detail = await get(`/match/${matches.m3.id}`, users.outsider.id);
      expect(detail.status).toBe(200);
      expect(detail.body.stats.actionsExecuted).toBe(HIDDEN_ACTIONS);
    });

    it("adds the revealed match to the global stats", async () => {
      const body = await globalStats();
      expect(Number(body.actionsExecuted)).toBe(QUEUE_ACTIONS + HIDDEN_ACTIONS);
      // The elimination match is still hidden.
      expect(Number(body.damageTotal)).toBe(HIDDEN_DAMAGE);
    });

    it("counts gambling matches in the global stats", async () => {
      // Gambling results are shown in the gambling summary.
      const gamblingDamage = 2468;
      await createMatch(MatchPhase.GAMBLING, 0, ["B", "D"], "B", false, {
        damageTotal: gamblingDamage,
      });
      const body = await globalStats();
      expect(Number(body.damageTotal)).toBe(HIDDEN_DAMAGE + gamblingDamage);
    });
  });
});
