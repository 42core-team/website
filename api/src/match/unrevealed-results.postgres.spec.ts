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
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
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

// A dedicated test database is required; each run owns only its random schema.
const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

const HIDDEN_ACTIONS = 918273;
const HIDDEN_DAMAGE = 564738;
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

// Response bodies are untyped JSON.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

postgres("unrevealed match results (PostgreSQL)", () => {
  const schema = `reveal_test_${randomUUID().replaceAll("-", "")}`;
  let database: DataSource;
  let app: INestApplication;
  let event: EventEntity;
  const teams: Record<"A" | "B" | "C" | "D", TeamEntity> = {} as never;
  const users: Record<"member" | "invitee" | "admin" | "outsider", UserEntity> =
    {} as never;
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
    );
    // The constructor opens queue clients; the read paths never use them.
    Object.assign(matchService, {
      teamService,
      eventService,
      matchRepository: database.getRepository(MatchEntity),
      matchStatsRepository: database.getRepository(MatchStatsEntity),
      dataSource: database,
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [MatchController, TeamController],
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
    app.useGlobalFilters(new TypeormExceptionFilter());
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
    for (const key of ["member", "invitee", "admin", "outsider"] as const)
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
        users: key === "A" ? [users.member] : [],
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

  function standings(list: Json[]) {
    return Object.fromEntries(
      list.map((team) => [
        team.name,
        { score: team.score, buchholzPoints: team.buchholzPoints },
      ]),
    );
  }

  describe("before the hidden match is revealed", () => {
    it("never returns unrevealed standings from the anonymous team profile", async () => {
      const response = await get(`/team/${teams.A.id}`);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: teams.A.id,
        name: "Team A",
        score: 1,
        buchholzPoints: 0,
        tags: [],
      });
      for (const field of [
        "credits",
        "repo",
        "repositoryError",
        "repositoryOperationId",
        "queueScore",
        "lastCreditGrantedAt",
      ])
        expect(response.body).not.toHaveProperty(field);
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

    it("hides unrevealed tournament results from a normal user", async () => {
      const body = await tournament(users.outsider.id);
      expect(body).toHaveLength(2);
      expectNoHiddenData(body);
      expectMatchTeamsIdentityOnly(body);
      expectHiddenMatch(findHidden(body, matches.e2));
      expect(findById(body, matches.e1.id)?.winner.id).toBe(teams.A.id);
    });

    it("answers unknown and unrevealed match ids alike", async () => {
      const unknown = await get(`/match/${randomUUID()}`, users.outsider.id);
      expect(unknown.status).toBe(404);
      for (const match of [matches.m3, matches.e2]) {
        const response = await get(`/match/${match.id}`, users.outsider.id);
        expect(response.status).toBe(404);
        expect(response.body.message).toBe(unknown.body.message);
        expectNoHiddenData(response.body);
      }
    });

    it("shows a revealed match detail without stored standings", async () => {
      const response = await get(`/match/${matches.m1.id}`, users.outsider.id);
      expect(response.status).toBe(200);
      expect(response.body.winner.id).toBe(teams.A.id);
      expectMatchTeamsIdentityOnly([response.body]);
      expect(JSON.stringify(response.body)).not.toContain('"buchholzPoints"');
    });

    it("keeps queue matches reachable by id without their results", async () => {
      const response = await get(`/match/${matches.queue.id}`, users.member.id);
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(matches.queue.id);
      expect(response.body.state).toBe(MatchState.PLANNED);
      expect(response.body).not.toHaveProperty("winner");
      expect(response.body).not.toHaveProperty("results");
      expect(response.body).not.toHaveProperty("stats");
      expect(response.body.teams).toHaveLength(2);
    });

    it("applies the public standings to the own team and pending invites", async () => {
      const my = await get(`/team/event/${event.id}/my`, users.member.id);
      expect(my.status).toBe(200);
      expect(my.body).toMatchObject({
        id: teams.A.id,
        score: 1,
        buchholzPoints: 0,
        repo: "repo-A",
      });

      const pending = await get(
        `/team/event/${event.id}/pending`,
        users.invitee.id,
      );
      expect(pending.status).toBe(200);
      expect(pending.body).toHaveLength(1);
      expect(pending.body[0]).toMatchObject({
        id: teams.C.id,
        score: 1,
        buchholzPoints: 0,
      });
      expect(pending.body[0]).not.toHaveProperty("credits");
      expect(pending.body[0]).not.toHaveProperty("repo");
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

      expect(standings(await teamList(users.admin.id, true))).toEqual({
        "Team A": { score: 2, buchholzPoints: STORED_BUCHHOLZ.A },
        "Team B": { score: 0, buchholzPoints: STORED_BUCHHOLZ.B },
        "Team C": { score: 1, buchholzPoints: STORED_BUCHHOLZ.C },
        "Team D": { score: 0, buchholzPoints: STORED_BUCHHOLZ.D },
      });
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
      expect(list[0]).not.toHaveProperty("credits");

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
    });
  });

  describe("after the hidden match is revealed", () => {
    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .put(`/match/reveal/${matches.m3.id}`)
        .set("x-test-user", users.admin.id);
      expect(response.status).toBe(200);
    });

    it("updates public standings and match details together", async () => {
      expect(standings(await teamList(users.outsider.id))).toEqual({
        "Team A": { score: 2, buchholzPoints: 1 },
        "Team B": { score: 0, buchholzPoints: 2 },
        "Team C": { score: 1, buchholzPoints: 2 },
        "Team D": { score: 0, buchholzPoints: 1 },
      });
      expect((await get(`/team/${teams.A.id}`)).body).toMatchObject({
        score: 2,
        buchholzPoints: 1,
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
  });
});
