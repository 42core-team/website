jest.mock("../main", () => ({ getRabbitmqConfig: jest.fn() }));

import { Logger } from "@nestjs/common";
import { EventEntity } from "../event/entities/event.entity";
import { EventState } from "../event/event-lifecycle";
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
