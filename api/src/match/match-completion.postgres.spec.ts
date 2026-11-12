jest.mock("../main", () => ({ getRabbitmqConfig: jest.fn() }));
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { DataSource } from "typeorm";
import { EventEntity } from "../event/entities/event.entity";
import { RepositoryStatus, TeamEntity } from "../team/entities/team.entity";
import { MatchEntity, MatchPhase, MatchState } from "./entites/match.entity";
import { MatchStatsEntity } from "./entites/matchStats.entity";
import { MatchTeamResultEntity } from "./entites/match.team.result.entity";
import { MatchService } from "./match.service";

const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;
postgres("atomic match completion (PostgreSQL)", () => {
  const schema = `completion_${randomUUID().replaceAll("-", "")}`;
  let database: DataSource;
  let service: MatchService;
  const stats = { actions_executed: 42 } as Parameters<
    MatchService["processMatchResult"]
  >[2];
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
    service = Object.create(MatchService.prototype) as MatchService;
    Object.assign(service, {
      dataSource: database,
      matchRepository: database.getRepository(MatchEntity),
      logger: { log: jest.fn(), warn: jest.fn() },
    });
  });
  afterAll(async () => {
    await database.query(`DROP SCHEMA "${schema}" CASCADE`);
    await database.destroy();
  });
  async function fixture(phase = MatchPhase.QUEUE) {
    const event = await database.getRepository(EventEntity).save({
      name: randomUUID(),
      githubOrg: "org",
      githubOrgSecret: "secret",
      minTeamSize: 1,
      maxTeamSize: 4,
      startDate: new Date(0),
      submissionDeadline: new Date(0),
      endDate: new Date("2100-01-01"),
      scheduledEndDate: new Date("2100-01-01"),
      currentRound: 0,
    });
    const teams = await database.getRepository(TeamEntity).save(
      ["a", "b", "c", "d"].map((name) => ({
        name,
        event,
        repositoryStatus: RepositoryStatus.LOCKED,
        repo: name,
        score: 0,
        queueScore: 1000,
        credits: 5,
      })),
    );
    const match = await database.getRepository(MatchEntity).save({
      teams: teams.slice(0, 2),
      phase,
      round: 0,
      state: MatchState.IN_PROGRESS,
      creditWager: 1,
      creditWagerTeam: teams[0],
      stats: new MatchStatsEntity(),
    });
    return {
      event,
      teams,
      match,
      result: { matchId: match.id, winnerId: teams[0].id, stats },
    };
  }
  it("applies concurrent duplicate results exactly once and rejects a conflicting winner", async () => {
    const { match, teams, result } = await fixture();
    await Promise.all(
      Array.from({ length: 6 }, () => service.completeMatch(result)),
    );
    const winner = await database
      .getRepository(TeamEntity)
      .findOneByOrFail({ id: teams[0].id });
    expect(winner.queueScore).toBe(1016);
    expect(winner.credits).toBe(6);
    expect(
      await database
        .getRepository(MatchTeamResultEntity)
        .countBy({ match: { id: match.id } }),
    ).toBe(2);
    await expect(
      service.completeMatch({ ...result, winnerId: teams[1].id }),
    ).rejects.toThrow("Conflicting");
  });
  it("rolls back scores, credits, stats and result rows when saving completion fails, then retries", async () => {
    const { match, teams, result } = await fixture();
    await database.query(
      `CREATE FUNCTION "${schema}".reject_completion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$`,
    );
    await database.query(
      `CREATE TRIGGER reject_completion BEFORE UPDATE ON "${schema}".matches FOR EACH ROW EXECUTE FUNCTION "${schema}".reject_completion()`,
    );
    try {
      await expect(service.completeMatch(result)).rejects.toThrow(
        "injected failure",
      );
    } finally {
      await database.query(
        `DROP TRIGGER reject_completion ON "${schema}".matches`,
      );
    }
    const winner = await database
      .getRepository(TeamEntity)
      .findOneByOrFail({ id: teams[0].id });
    expect(winner.queueScore).toBe(1000);
    expect(winner.credits).toBe(5);
    const current = await database
      .getRepository(MatchEntity)
      .findOneByOrFail({ id: match.id });
    expect(current.state).toBe(MatchState.IN_PROGRESS);
    expect(current.stats.actionsExecuted).not.toBe(42);
    expect(
      await database
        .getRepository(MatchTeamResultEntity)
        .countBy({ match: { id: match.id } }),
    ).toBe(0);
    await service.completeMatch(result);
    expect(
      (
        await database
          .getRepository(TeamEntity)
          .findOneByOrFail({ id: teams[0].id })
      ).credits,
    ).toBe(6);
  });
  it("rolls back completion and round advancement when pairing fails", async () => {
    const { event, match, teams, result } = await fixture(MatchPhase.SWISS);
    const create = jest
      .spyOn(service, "createNextSwissMatches")
      .mockRejectedValueOnce(new Error("pairing failed"));
    await expect(service.completeMatch(result)).rejects.toThrow(
      "pairing failed",
    );
    expect(
      (
        await database
          .getRepository(EventEntity)
          .findOneByOrFail({ id: event.id })
      ).currentRound,
    ).toBe(0);
    expect(
      (
        await database
          .getRepository(TeamEntity)
          .findOneByOrFail({ id: teams[0].id })
      ).score,
    ).toBe(0);
    expect(
      (
        await database
          .getRepository(MatchEntity)
          .findOneByOrFail({ id: match.id })
      ).state,
    ).toBe(MatchState.IN_PROGRESS);
    create.mockRestore();
    const start = jest
      .spyOn(service, "startMatch")
      .mockImplementation(async (id) => {
        // Separate connection must see committed round and pairings before dispatch.
        expect(
          (
            await database
              .getRepository(EventEntity)
              .findOneByOrFail({ id: event.id })
          ).currentRound,
        ).toBe(1);
        expect(await database.getRepository(MatchEntity).existsBy({ id })).toBe(
          true,
        );
      });
    await service.completeMatch(result);
    expect(start).toHaveBeenCalledTimes(2);
    start.mockRestore();
  });
  it("serializes the last two Swiss results and creates only one next round", async () => {
    const { event, match, teams, result } = await fixture(MatchPhase.SWISS);
    const other = await database.getRepository(MatchEntity).save({
      teams: teams.slice(2),
      phase: MatchPhase.SWISS,
      round: 0,
      state: MatchState.IN_PROGRESS,
      stats: new MatchStatsEntity(),
    });
    const start = jest
      .spyOn(service, "startMatch")
      .mockResolvedValue(undefined);
    await Promise.all([
      service.completeMatch(result),
      service.completeMatch({
        ...result,
        matchId: other.id,
        winnerId: teams[2].id,
      }),
    ]);
    expect(
      (
        await database
          .getRepository(EventEntity)
          .findOneByOrFail({ id: event.id })
      ).currentRound,
    ).toBe(1);
    expect(
      await database.getRepository(MatchEntity).countBy({
        teams: { event: { id: event.id } },
        round: 1,
        phase: MatchPhase.SWISS,
      }),
    ).toBe(2);
    await service.completeMatch(result);
    expect(start).toHaveBeenCalledTimes(2);
    expect(
      (
        await database
          .getRepository(MatchEntity)
          .findOneByOrFail({ id: match.id })
      ).state,
    ).toBe(MatchState.FINISHED);
    start.mockRestore();
  });
  it("uses the completion transaction for gambling settlement and rolls everything back if it fails", async () => {
    const { match, result } = await fixture(MatchPhase.GAMBLING);
    const settleMatch = jest.fn(
      async (_id: string, _winner: string, manager: DataSource["manager"]) => {
        expect(manager.queryRunner?.isTransactionActive).toBe(true);
        throw new Error("settlement failed");
      },
    );
    Object.assign(service, { gamblingService: { settleMatch } });
    await expect(service.completeMatch(result)).rejects.toThrow(
      "settlement failed",
    );
    expect(
      (
        await database
          .getRepository(MatchEntity)
          .findOneByOrFail({ id: match.id })
      ).state,
    ).toBe(MatchState.IN_PROGRESS);
    expect(
      await database
        .getRepository(MatchTeamResultEntity)
        .countBy({ match: { id: match.id } }),
    ).toBe(0);
  });
  it("recovers planned pairings after post-commit dispatch fails", async () => {
    const { event, result } = await fixture(MatchPhase.SWISS);
    const start = jest
      .spyOn(service, "startMatch")
      .mockRejectedValueOnce(new Error("dispatch interrupted"))
      .mockResolvedValue(undefined);
    await expect(service.completeMatch(result)).rejects.toThrow(
      "dispatch interrupted",
    );
    Object.assign(service, {
      eventService: {
        getEventById: (id: string) =>
          database
            .getRepository(EventEntity)
            .findOneOrFail({ where: { id }, relations: { teams: true } }),
      },
    });
    await service.completeMatch(result);
    expect(start).toHaveBeenCalledTimes(1);
    await service.startPlannedTournamentMatches();
    const pairings = await database
      .getRepository(MatchEntity)
      .findBy({ teams: { event: { id: event.id } }, round: 1 });
    const ids = new Set(pairings.map((match) => match.id));
    expect(start.mock.calls.filter(([id]) => ids.has(id))).toHaveLength(3);
    expect(
      (
        await database
          .getRepository(EventEntity)
          .findOneByOrFail({ id: event.id })
      ).currentRound,
    ).toBe(1);
    start.mockRestore();
  });
});
