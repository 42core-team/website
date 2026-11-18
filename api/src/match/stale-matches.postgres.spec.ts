// match.service imports the application bootstrap for its queue config.
jest.mock("../main", () => ({ getRabbitmqConfig: jest.fn() }));

import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { Logger } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import { MatchEntity, MatchPhase, MatchState } from "./entites/match.entity";
import { MatchStatsEntity } from "./entites/matchStats.entity";
import { MatchService } from "./match.service";
import {
  findStaleMatches,
  MAX_START_ATTEMPTS,
  resetStaleMatch,
  STALE_MATCH_MAX_AGE_HOURS,
  STALE_MATCH_TIMEOUT_MINUTES,
} from "./stale-matches";

// A dedicated test database is required; each run owns only its random schema.
const databaseUrl = process.env.SESSION_TEST_DATABASE_URL;
const postgres = databaseUrl ? describe : describe.skip;

const STALE = STALE_MATCH_TIMEOUT_MINUTES + 5;
const FRESH = STALE_MATCH_TIMEOUT_MINUTES - 5;
const TOO_OLD = (STALE_MATCH_MAX_AGE_HOURS + 1) * 60;

postgres("stale matches (PostgreSQL)", () => {
  const schema = `stale_match_test_${randomUUID().replaceAll("-", "")}`;
  let database: DataSource;
  let matches: Repository<MatchEntity>;

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
    matches = database.getRepository(MatchEntity);
  });

  afterAll(async () => {
    if (database?.isInitialized) {
      await database.query(`DROP SCHEMA "${schema}" CASCADE`);
      await database.destroy();
    }
  });

  beforeEach(async () => {
    await database.query(`TRUNCATE "${schema}"."matches" CASCADE`);
  });

  /** Ages are in minutes; null keeps startedAt unset like pre-migration rows. */
  async function createMatch(
    state: MatchState,
    startedMinutesAgo: number | null,
    { updatedMinutesAgo = 0, startAttempts = 1 } = {},
  ) {
    const match = await matches.save(
      matches.create({
        state,
        round: 0,
        phase: MatchPhase.QUEUE,
        stats: new MatchStatsEntity(),
      }),
    );
    // Raw SQL, so TypeORM does not bump updatedAt.
    await database.query(
      `UPDATE "${schema}"."matches"
         SET "startAttempts" = $2,
             "startedAt" = CASE WHEN $3::int IS NULL THEN NULL
                                ELSE now() - make_interval(mins => $3::int) END,
             "updatedAt" = now() - make_interval(mins => $4::int)
       WHERE id = $1`,
      [match.id, startAttempts, startedMinutesAgo, updatedMinutesAgo],
    );
    return match.id;
  }

  const reload = (id: string) => matches.findOneByOrFail({ id });

  it("finds stale IN_PROGRESS and stranded PLANNED matches only", async () => {
    const stale = await createMatch(MatchState.IN_PROGRESS, STALE);
    const stranded = await createMatch(MatchState.PLANNED, STALE);
    await createMatch(MatchState.IN_PROGRESS, FRESH);
    // A reveal bumps updatedAt; only startedAt counts.
    await createMatch(MatchState.IN_PROGRESS, FRESH, {
      updatedMinutesAgo: STALE,
    });
    // Started before startedAt existed: never touched.
    await createMatch(MatchState.IN_PROGRESS, null, {
      updatedMinutesAgo: STALE,
      startAttempts: 0,
    });
    await createMatch(MatchState.PLANNED, null, { updatedMinutesAgo: STALE });
    // Last started more than the maximum age ago: left alone.
    await createMatch(MatchState.IN_PROGRESS, TOO_OLD);
    await createMatch(MatchState.PLANNED, TOO_OLD);
    await createMatch(MatchState.FINISHED, STALE);

    const found = await findStaleMatches(matches);

    expect(found.map((match) => match.id).sort()).toEqual(
      [stale, stranded].sort(),
    );
    expect(found.find((match) => match.id === stale)).toMatchObject({
      state: MatchState.IN_PROGRESS,
      startAttempts: 1,
    });
  });

  it("resets only the same stale run", async () => {
    const id = await createMatch(MatchState.IN_PROGRESS, STALE);
    const match = { id, state: MatchState.IN_PROGRESS, startAttempts: 1 };

    expect(await resetStaleMatch(matches, { ...match, startAttempts: 0 })).toBe(
      false,
    );
    expect(await resetStaleMatch(matches, match)).toBe(true);
    expect((await reload(id)).state).toBe(MatchState.PLANNED);
    // A second replica with the same snapshot loses.
    expect(await resetStaleMatch(matches, match)).toBe(false);
  });

  it("lets a result that arrived first win", async () => {
    const id = await createMatch(MatchState.FINISHED, STALE);

    expect(
      await resetStaleMatch(matches, {
        id,
        state: MatchState.IN_PROGRESS,
        startAttempts: 1,
      }),
    ).toBe(false);
    expect((await reload(id)).state).toBe(MatchState.FINISHED);
  });

  it("does not reset a match that was restarted meanwhile", async () => {
    const id = await createMatch(MatchState.IN_PROGRESS, FRESH);

    expect(
      await resetStaleMatch(matches, {
        id,
        state: MatchState.IN_PROGRESS,
        startAttempts: 1,
      }),
    ).toBe(false);
  });

  it.each([
    ["started before startedAt existed", null, 0],
    ["started more than the maximum age ago", TOO_OLD, 1],
  ])(
    "does not reset a match %s",
    async (_case, startedMinutesAgo, startAttempts) => {
      const id = await createMatch(MatchState.IN_PROGRESS, startedMinutesAgo, {
        updatedMinutesAgo: TOO_OLD,
        startAttempts,
      });

      expect(
        await resetStaleMatch(matches, {
          id,
          state: MatchState.IN_PROGRESS,
          startAttempts,
        }),
      ).toBe(false);
      const match = await reload(id);
      expect(match.state).toBe(MatchState.IN_PROGRESS);
      expect(match.startAttempts).toBe(startAttempts);
    },
  );

  it("leaves the start time alone when resetting", async () => {
    const id = await createMatch(MatchState.IN_PROGRESS, STALE);
    const before = (await reload(id)).startedAt;

    expect(
      await resetStaleMatch(matches, {
        id,
        state: MatchState.IN_PROGRESS,
        startAttempts: 1,
      }),
    ).toBe(true);

    expect((await reload(id)).startedAt).toEqual(before);
    // Still found as stale if the API died before startMatch ran.
    expect((await findStaleMatches(matches)).map((match) => match.id)).toEqual([
      id,
    ]);
  });

  it("restarts through startMatch and stops at the attempt limit", async () => {
    const restartable = await createMatch(MatchState.IN_PROGRESS, STALE, {
      startAttempts: MAX_START_ATTEMPTS - 1,
    });
    const exhausted = await createMatch(MatchState.IN_PROGRESS, STALE, {
      startAttempts: MAX_START_ATTEMPTS,
    });
    const emit = jest.fn();
    const service = Object.create(MatchService.prototype) as MatchService;
    Object.assign(service, {
      logger: new Logger("test"),
      matchRepository: matches,
      dataSource: database,
      configService: { get: jest.fn().mockReturnValue(undefined) },
      gameQueue: { emit },
    });
    jest
      .spyOn(service as never, "buildNewMatchMessage")
      .mockImplementation((async (matchId: string) => ({
        id: matchId,
      })) as never);

    await service.restartStaleMatches();

    const restarted = await reload(restartable);
    expect(restarted.state).toBe(MatchState.IN_PROGRESS);
    expect(restarted.startAttempts).toBe(MAX_START_ATTEMPTS);
    expect(Date.now() - restarted.startedAt!.getTime()).toBeLessThan(60_000);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith("new_match", { id: restartable });

    const untouched = await reload(exhausted);
    expect(untouched.state).toBe(MatchState.IN_PROGRESS);
    expect(untouched.startAttempts).toBe(MAX_START_ATTEMPTS);

    // The restarted match is fresh now; nothing more happens.
    await service.restartStaleMatches();
    expect(emit).toHaveBeenCalledTimes(1);
  });
});
