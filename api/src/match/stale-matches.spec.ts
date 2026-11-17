jest.mock("../main", () => ({ getRabbitmqConfig: jest.fn() }));

import { Logger } from "@nestjs/common";
import { LockKeys } from "../constants";
import { instanceToPlain } from "class-transformer";
import { MatchEntity, MatchState } from "./entites/match.entity";
import { MatchService } from "./match.service";
import {
  MAX_START_ATTEMPTS,
  STALE_MATCH_TIMEOUT_MINUTES,
  type StaleMatch,
} from "./stale-matches";

function setup(
  stale: StaleMatch[],
  {
    acquired = true,
    affected = 1,
  }: { acquired?: boolean; affected?: number } = {},
) {
  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(stale),
    execute: jest.fn().mockResolvedValue({ affected }),
  };
  const queryRunner = {
    connect: jest.fn(),
    release: jest.fn(),
    query: jest.fn().mockImplementation(async (sql: string) => {
      if (sql.includes("pg_try_advisory_lock")) return [{ acquired }];
      return [];
    }),
  };
  const logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn() };
  const service = Object.create(MatchService.prototype) as MatchService;
  Object.assign(service, {
    logger,
    matchRepository: {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    },
    dataSource: { createQueryRunner: jest.fn().mockReturnValue(queryRunner) },
  });
  const startMatch = jest
    .spyOn(service, "startMatch")
    .mockResolvedValue(undefined);
  return { service, queryBuilder, queryRunner, logger, startMatch };
}

const inProgress = (id: string, startAttempts: number): StaleMatch => ({
  id,
  state: MatchState.IN_PROGRESS,
  startAttempts,
});

describe("restartStaleMatches", () => {
  it("restarts a stale match below the attempt limit", async () => {
    const { service, queryBuilder, logger, startMatch } = setup([
      inProgress("stale", 1),
    ]);

    await service.restartStaleMatches();

    expect(queryBuilder.set).toHaveBeenCalledWith(
      expect.objectContaining({ state: MatchState.PLANNED }),
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      `"startAttempts" = :startAttempts`,
      { startAttempts: 1 },
    );
    expect(startMatch).toHaveBeenCalledWith("stale");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "restart_stale_match",
        matchId: "stale",
        attempt: 2,
      }),
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("leaves matches at the limit alone and logs them once per run", async () => {
    const { service, queryBuilder, logger, startMatch } = setup([
      inProgress("first", MAX_START_ATTEMPTS),
      inProgress("second", MAX_START_ATTEMPTS + 1),
    ]);

    await service.restartStaleMatches();

    expect(queryBuilder.execute).not.toHaveBeenCalled();
    expect(startMatch).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith({
      action: "stale_match_gave_up",
      matchIds: ["first", "second"],
      maxStartAttempts: MAX_START_ATTEMPTS,
      timeoutMinutes: STALE_MATCH_TIMEOUT_MINUTES,
    });
  });

  it("does not start the match when the compare-and-set loses", async () => {
    const { service, queryBuilder, logger, startMatch } = setup(
      [inProgress("raced", 0)],
      { affected: 0 },
    );

    await service.restartStaleMatches();

    expect(queryBuilder.execute).toHaveBeenCalledTimes(1);
    expect(startMatch).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("starts a stale PLANNED match without resetting it first", async () => {
    const { service, queryBuilder, startMatch } = setup([
      { id: "stranded", state: MatchState.PLANNED, startAttempts: 1 },
    ]);

    await service.restartStaleMatches();

    expect(queryBuilder.execute).not.toHaveBeenCalled();
    expect(startMatch).toHaveBeenCalledWith("stranded");
  });

  it("keeps going when one restart fails", async () => {
    const { service, logger, startMatch } = setup([
      inProgress("broken", 0),
      inProgress("fine", 0),
    ]);
    startMatch.mockRejectedValueOnce(new Error("no token"));

    await service.restartStaleMatches();

    expect(startMatch).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith({
      action: "restart_stale_match_failed",
      matchId: "broken",
      reason: "no token",
    });
  });

  it("does nothing while another replica holds the lock", async () => {
    const { service, queryBuilder, queryRunner, startMatch } = setup(
      [inProgress("stale", 0)],
      { acquired: false },
    );

    await service.restartStaleMatches();

    expect(queryRunner.query).toHaveBeenCalledWith(
      "SELECT pg_try_advisory_lock($1) AS acquired",
      [LockKeys.RESTART_STALE_MATCHES],
    );
    expect(queryBuilder.getMany).not.toHaveBeenCalled();
    expect(startMatch).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it("releases the lock after a run", async () => {
    const { service, queryRunner } = setup([]);

    await service.restartStaleMatches();

    expect(queryRunner.query).toHaveBeenCalledWith(
      "SELECT pg_advisory_unlock($1)",
      [LockKeys.RESTART_STALE_MATCHES],
    );
    expect(queryRunner.release).toHaveBeenCalled();
  });
});

describe("startMatch start bookkeeping", () => {
  it("counts the attempt and stamps the start in the PLANNED -> IN_PROGRESS update", async () => {
    const queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = Object.create(MatchService.prototype) as MatchService;
    Object.assign(service, {
      logger: new Logger("test"),
      matchRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
        findOne: jest.fn().mockResolvedValue({ id: "match", teams: [] }),
      },
      configService: { get: jest.fn().mockReturnValue("true") },
      gameResultsQueue: { emit: jest.fn() },
    });
    jest.useFakeTimers();
    try {
      await service.startMatch("match");
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }

    const [values] = queryBuilder.set.mock.calls[0];
    expect(values.state).toBe(MatchState.IN_PROGRESS);
    expect(values.startedAt()).toBe("now()");
    expect(values.startAttempts()).toBe(`"startAttempts" + 1`);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith("state = :state", {
      state: MatchState.PLANNED,
    });
  });
});

describe("start bookkeeping serialization", () => {
  it("keeps startAttempts and startedAt out of API responses", () => {
    const match = Object.assign(new MatchEntity(), {
      id: "match",
      state: MatchState.IN_PROGRESS,
      startAttempts: 2,
      startedAt: new Date(),
    });

    const plain = instanceToPlain(match);

    expect(plain).toMatchObject({ id: "match" });
    expect(plain).not.toHaveProperty("startAttempts");
    expect(plain).not.toHaveProperty("startedAt");
  });
});
