jest.mock("../main", () => ({ getRabbitmqConfig: jest.fn() }));

import { Logger } from "@nestjs/common";
import { EventEntity } from "../event/entities/event.entity";
import { EventState } from "../event/event-lifecycle";
import { getEventLockKey } from "../event/event-lock";
import { TeamEntity } from "../team/entities/team.entity";
import { MatchPhase } from "./entites/match.entity";
import { MatchService } from "./match.service";

function setup(state = EventState.SUBMISSIONS_CLOSED, status = "LOCKED") {
  const teams = ["one", "two", "excluded"].map((id) =>
    Object.assign(new TeamEntity(), {
      id,
      score: 0,
      hadBye: false,
      repositoryStatus: id === "excluded" ? "FAILED" : status,
      tournamentExcluded: id === "excluded",
    }),
  );
  const event = Object.assign(new EventEntity(), {
    id: "event",
    state,
    currentRound: 0,
    teams,
    startDate: new Date(Date.now() - 10000),
    submissionDeadline: new Date(Date.now() + 10000),
  });
  const save = jest.fn().mockImplementation((match) => Promise.resolve(match));
  const service = Object.create(MatchService.prototype) as MatchService;
  Object.assign(service, {
    logger: new Logger("test"),
    eventService: { getEventById: jest.fn().mockResolvedValue(event) },
    teamService: {
      getTeamById: jest.fn().mockResolvedValue({ event }),
      getSortedTeamsForTournament: jest
        .fn()
        .mockResolvedValue([teams[2], ...teams.slice(0, 2)]),
    },
    matchRepository: {
      countBy: jest.fn().mockResolvedValue(0),
      create: jest.fn((value) => value),
      save,
    },
  });
  jest.spyOn(service, "startMatch").mockResolvedValue(undefined);
  jest.spyOn(service, "getFormerOpponents").mockResolvedValue([]);
  return { service, event, save };
}

describe("tournament lifecycle mutation gates", () => {
  it.each([EventState.REGISTRATION, EventState.PLAYING, EventState.COMPLETED])(
    "rejects generation in %s",
    async (state) => {
      const { service, event, save } = setup(state);
      if (state === EventState.REGISTRATION)
        event.startDate = new Date(Date.now() + 10000);
      await expect(service.createNextSwissMatches(event.id)).rejects.toThrow(
        "closed submissions",
      );
      await expect(
        service.createNextTournamentMatches(event.id),
      ).rejects.toThrow("closed submissions");
      await expect(service.createFirstTournamentMatches(event)).rejects.toThrow(
        "closed submissions",
      );
      await expect(
        service.createMatch(["one", "two"], 0, MatchPhase.SWISS),
      ).rejects.toThrow("closed submissions");
      expect(save).not.toHaveBeenCalled();
    },
  );

  it.each([
    "PENDING",
    "PROVISIONING",
    "READY",
    "LOCKING",
    "UNLOCKING",
    "FAILED",
  ])("rejects unconfirmed repositories (%s)", async (status) => {
    const { service, event, save } = setup(
      EventState.SUBMISSIONS_CLOSED,
      status,
    );
    await expect(service.createNextSwissMatches(event.id)).rejects.toThrow(
      "confirmed LOCKED",
    );
    await expect(service.createNextTournamentMatches(event.id)).rejects.toThrow(
      "confirmed LOCKED",
    );
    expect(save).not.toHaveBeenCalled();
  });

  it.each([EventState.SUBMISSIONS_CLOSED, EventState.SHOWCASE])(
    "generates both formats in %s, excluding failed excluded teams",
    async (state) => {
      const { service, event, save } = setup(state);
      await service.createNextSwissMatches(event.id);
      await service.createNextTournamentMatches(event.id);
      expect(save).toHaveBeenCalledTimes(2);
      for (const [match] of save.mock.calls)
        expect(match.teams.map((team: TeamEntity) => team.id).sort()).toEqual([
          "one",
          "two",
        ]);
      expect(await service.getTournamentTeamCount(event.id)).toBe(2);
      await expect(
        service.createMatch(["one", "excluded"], 0, MatchPhase.ELIMINATION),
      ).rejects.toThrow("nonexcluded");
    },
  );
});

describe("tournament advancement limit", () => {
  function setupEntrants(count: number, limit: number | null) {
    const context = setup();
    const { event, service } = context;
    event.tournamentAdvancementLimit = limit;
    event.teams = Array.from({ length: count }, (_, index) =>
      Object.assign(new TeamEntity(), {
        id: `team-${index}`,
        score: 0,
        hadBye: false,
        repositoryStatus: "LOCKED",
        tournamentExcluded: false,
      }),
    );
    Object.assign(service, {
      teamService: {
        getTeamById: jest.fn().mockResolvedValue({ event }),
        getSortedTeamsForTournament: jest.fn().mockResolvedValue(event.teams),
      },
    });
    return context;
  }

  it.each([
    [20, null, 16],
    [20, 8, 8],
    [20, 2, 2],
    [6, 16, 4],
    [8, 8, 8],
  ])(
    "with %i entrants and limit %s, %i teams advance",
    async (entrants, limit, expected) => {
      const { service, event } = setupEntrants(entrants, limit);
      expect(await service.getTournamentTeamCount(event.id)).toBe(expected);
    },
  );

  it("seeds only the top-ranked teams up to the limit", async () => {
    const { service, event, save } = setupEntrants(10, 4);
    await service.createNextTournamentMatches(event.id);
    expect(save).toHaveBeenCalledTimes(2);
    const seeded = save.mock.calls.flatMap(([match]) =>
      match.teams.map((team: TeamEntity) => team.id),
    );
    expect(seeded.sort()).toEqual(["team-0", "team-1", "team-2", "team-3"]);
  });
});

describe("starting tournament matches", () => {
  function setupLock(service: MatchService) {
    const queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([]),
    };
    Object.assign(service, {
      dataSource: { createQueryRunner: () => queryRunner },
    });
    return queryRunner;
  }

  it("generates the bracket while holding the event lock", async () => {
    const { service, event, save } = setup();
    const queryRunner = setupLock(service);
    await service.startTournamentMatches(event.id);
    expect(queryRunner.query).toHaveBeenCalledWith(
      "SELECT pg_advisory_xact_lock($1, $2)",
      getEventLockKey(event.id),
    );
    expect(queryRunner.query.mock.invocationCallOrder[0]).toBeLessThan(
      save.mock.invocationCallOrder[0],
    );
    expect(save.mock.invocationCallOrder[0]).toBeLessThan(
      queryRunner.commitTransaction.mock.invocationCallOrder[0],
    );
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it("releases the event lock when generation fails", async () => {
    const { service, event } = setup(EventState.PLAYING);
    const queryRunner = setupLock(service);
    await expect(service.startTournamentMatches(event.id)).rejects.toThrow(
      "closed submissions",
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });
});

describe("Swiss progression across a reopen", () => {
  function setupFourEntrants() {
    const context = setup(EventState.PLAYING);
    const { service, event } = context;
    event.teams = ["a", "b", "c", "d"].map((id) =>
      Object.assign(new TeamEntity(), {
        id,
        score: 0,
        hadBye: false,
        repositoryStatus: "LOCKED",
        tournamentExcluded: false,
      }),
    );
    Object.assign(Reflect.get(service, "eventService"), {
      increaseEventRound: jest.fn(async () => {
        event.currentRound += 1;
      }),
    });
    const runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(),
    };
    Reflect.set(service, "dataSource", {
      createQueryRunner: () => runner,
      getRepository: () => ({ find: jest.fn().mockResolvedValue([event]) }),
    });
    return context;
  }

  it("pauses a round finished while reopened and resumes it after reclosing", async () => {
    const { service, event, save } = setupFourEntrants();
    await expect(
      service.processSwissFinishRound(event.id),
    ).resolves.toBeUndefined();
    expect(event.currentRound).toBe(1);
    expect(save).not.toHaveBeenCalled();
    expect(await service.getPausedProgressionPhase(event)).toBe(
      MatchPhase.SWISS,
    );

    // Still reopened: the resume job must not create matches.
    await service.resumePausedTournaments();
    expect(save).not.toHaveBeenCalled();

    event.state = EventState.SUBMISSIONS_CLOSED;
    await service.resumePausedTournaments();
    expect(save).toHaveBeenCalledTimes(2);
    for (const [match] of save.mock.calls) {
      expect(match.round).toBe(1);
      expect(match.phase).toBe(MatchPhase.SWISS);
    }
  });

  it("does not resume a round that already has matches", async () => {
    const { service, event, save } = setupFourEntrants();
    event.state = EventState.SUBMISSIONS_CLOSED;
    event.currentRound = 1;
    Object.assign(Reflect.get(service, "matchRepository"), {
      countBy: jest.fn().mockResolvedValue(2),
    });
    await service.resumeTournamentProgression(event.id);
    expect(save).not.toHaveBeenCalled();
  });
});
