// match.service imports the application bootstrap for its queue config.
jest.mock("../main", () => ({ getRabbitmqConfig: jest.fn() }));

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DataSource } from "typeorm";
import { EventEntity } from "../event/entities/event.entity";
import { MatchEntity, MatchState } from "../match/entites/match.entity";
import { RepositoryStatus, TeamEntity } from "./entities/team.entity";
import { TeamService } from "./team.service";

// A dedicated test database is required; each run owns only its random schema.
const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

const JOINS = 10;

postgres("queue repeat opponents (PostgreSQL)", () => {
  const schema = `queue_test_${randomUUID().replaceAll("-", "")}`;
  let database: DataSource;
  let teamService: TeamService;

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

    // Matches are never started or finished, as during rapid repeat joins.
    teamService = new TeamService(
      database.getRepository(TeamEntity),
      {} as never,
      {} as never,
      {} as never,
      { startMatch: jest.fn() } as never,
      database,
    );
  });

  afterAll(async () => {
    if (database?.isInitialized) {
      await database.query(`DROP SCHEMA "${schema}" CASCADE`);
      await database.destroy();
    }
  });

  async function createEventWithTeams(opponentElos: number[]) {
    const event = await database.getRepository(EventEntity).save({
      name: randomUUID().slice(0, 30),
      githubOrg: "org",
      githubOrgSecret: "secret",
      minTeamSize: 1,
      maxTeamSize: 4,
      maxQueueCredits: JOINS,
      startDate: new Date("2000-01-01"),
      submissionDeadline: new Date("2100-01-01"),
      scheduledEndDate: new Date("2100-01-01"),
      endDate: new Date("2100-01-01"),
    });
    const createTeam = (queueScore: number) =>
      database.getRepository(TeamEntity).save({
        name: randomUUID().slice(0, 20),
        event: { id: event.id },
        repositoryStatus: RepositoryStatus.READY,
        queueScore,
        credits: JOINS,
      });

    const team = await createTeam(1000);
    for (const elo of opponentElos) await createTeam(elo);
    return { eventId: event.id, teamId: team.id };
  }

  async function joinOnce(eventId: string, teamId: string) {
    const { matchId } = await teamService.joinQueue(teamId, eventId);
    const match = await database.getRepository(MatchEntity).findOneOrFail({
      where: { id: matchId },
      relations: { teams: true },
      loadEagerRelations: false,
    });
    expect(match.state).toBe(MatchState.PLANNED);
    return match.teams.find((matchTeam) => matchTeam.id !== teamId)!.id;
  }

  async function joinRepeatedly(eventId: string, teamId: string) {
    const opponentIds: string[] = [];
    for (let join = 0; join < JOINS; join++)
      opponentIds.push(await joinOnce(eventId, teamId));
    return opponentIds;
  }

  it.each([
    { pool: "two equal teams", elos: [1000, 1000], distinct: 2 },
    { pool: "three equal teams", elos: [1000, 1000, 1000], distinct: 3 },
    { pool: "seven equal teams", elos: Array(7).fill(1000), distinct: 7 },
    {
      pool: "a spread of ELOs",
      elos: [1000, 1020, 1050, 1100, 1200, 1400, 1800],
      distinct: 5,
    },
    {
      pool: "one close team and distant teams",
      elos: [1000, 1800, 1800, 1800, 1800],
      distinct: 5,
    },
  ])(
    "varies opponents across rapid joins with $pool",
    async ({ elos, distinct }) => {
      const { eventId, teamId } = await createEventWithTeams(elos);

      const opponentIds = await joinRepeatedly(eventId, teamId);

      expect(new Set(opponentIds).size).toBe(distinct);
      opponentIds.slice(1).forEach((opponentId, index) => {
        expect(opponentId).not.toBe(opponentIds[index]);
      });
    },
  );

  it("treats the match created last as the latest when joins overlap", async () => {
    const { eventId, teamId } = await createEventWithTeams([1000, 1000]);
    const service = teamService as unknown as {
      lockQueueEvent: (...args: unknown[]) => Promise<void>;
    };
    const lockQueueEvent = service.lockQueueEvent.bind(teamService);
    let slowJoinBegan!: () => void;
    const slowJoinHasBegun = new Promise<void>((resolve) => {
      slowJoinBegan = resolve;
    });
    let releaseSlowJoin!: () => void;
    const slowJoinReleased = new Promise<void>((resolve) => {
      releaseSlowJoin = resolve;
    });
    jest
      .spyOn(service, "lockQueueEvent")
      .mockImplementationOnce(async (...args) => {
        slowJoinBegan();
        await slowJoinReleased;
        return lockQueueEvent(...args);
      });

    // The slow join's transaction begins first but creates its match second.
    const slowJoin = joinOnce(eventId, teamId);
    await slowJoinHasBegun;
    await joinOnce(eventId, teamId);
    releaseSlowJoin();
    const latestOpponentId = await slowJoin;

    expect(await joinOnce(eventId, teamId)).not.toBe(latestOpponentId);
  });

  it("still matches the only available opponent", async () => {
    const { eventId, teamId } = await createEventWithTeams([1000]);

    const opponentIds = await joinRepeatedly(eventId, teamId);

    expect(new Set(opponentIds).size).toBe(1);
  });
});
