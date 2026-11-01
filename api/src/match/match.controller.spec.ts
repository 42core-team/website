jest.mock("./match.service", () => ({ MatchService: class MatchService {} }));
jest.mock("../event/event.service", () => ({
  EventService: class EventService {},
}));

import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { EventService } from "../event/event.service";
import { MatchEntity, MatchPhase, MatchState } from "./entites/match.entity";
import { MatchController } from "./match.controller";
import { MatchService } from "./match.service";
import { toVisibleMatchResponse } from "./match-response";

describe("match detail results", () => {
  function setup(phase: MatchPhase) {
    const match = toVisibleMatchResponse({
      id: "match",
      phase,
      state: MatchState.FINISHED,
      isRevealed: true,
      teams: [{ id: "team", name: "Team" }],
      winner: { id: "team", name: "Team" },
      results: [{ team: { id: "team", name: "Team" }, score: 1234 }],
    } as MatchEntity);
    const getMatchResponseById = jest.fn().mockResolvedValue(match);
    const controller = new MatchController(
      { getMatchResponseById } as unknown as MatchService,
      {} as EventService,
    );
    return { controller, match, getMatchResponseById };
  }

  it.each([false, true])(
    "strips revealed QUEUE ratings with admin reveal %s",
    async (adminReveal) => {
      const { controller, match, getMatchResponseById } = setup(
        MatchPhase.QUEUE,
      );
      const response = await controller.getMatchById(
        "match",
        "user",
        adminReveal,
      );

      expect("results" in response && response.results).toEqual([]);
      expect(JSON.stringify(response)).not.toContain('"score":1234');
      expect("winner" in response && response.winner).toEqual(match.winner);
      expect(response.state).toBe(MatchState.FINISHED);
      expect(match.results[0].score).toBe(1234);
      expect(getMatchResponseById).toHaveBeenCalledWith(
        "match",
        "user",
        adminReveal,
      );
    },
  );

  it.each([MatchPhase.SWISS, MatchPhase.ELIMINATION, MatchPhase.GAMBLING])(
    "preserves %s results",
    async (phase) => {
      const { controller, match } = setup(phase);
      const response = await controller.getMatchById("match", "user", false);
      expect(response).toBe(match);
      expect("results" in response && response.results[0].score).toBe(1234);
    },
  );
});

describe("manual matches", () => {
  function setup(isAdmin: boolean) {
    const createManualMatch = jest.fn().mockResolvedValue({ id: "match" });
    const getManualMatches = jest.fn().mockResolvedValue([]);
    const controller = new MatchController(
      { createManualMatch, getManualMatches } as unknown as MatchService,
      {
        isEventAdmin: jest.fn().mockResolvedValue(isAdmin),
      } as unknown as EventService,
    );
    return { controller, createManualMatch, getManualMatches };
  }

  it("lets event admins start a manual match", async () => {
    const { controller, createManualMatch } = setup(true);
    await expect(
      controller.createManualMatch("event", "admin", {
        teamOneId: "a",
        teamTwoId: "b",
      }),
    ).resolves.toEqual({ id: "match" });
    expect(createManualMatch).toHaveBeenCalledWith("event", "a", "b");
  });

  it("rejects non-admins", async () => {
    const { controller, createManualMatch, getManualMatches } = setup(false);
    await expect(
      controller.createManualMatch("event", "user", {
        teamOneId: "a",
        teamTwoId: "b",
      }),
    ).rejects.toThrow(UnauthorizedException);
    await expect(controller.getManualMatches("event", "user")).rejects.toThrow(
      UnauthorizedException,
    );
    expect(createManualMatch).not.toHaveBeenCalled();
    expect(getManualMatches).not.toHaveBeenCalled();
  });
});

describe("match reveal", () => {
  function setup(eventId: string | undefined, isAdmin: boolean) {
    const getEventIdOfMatch = jest.fn().mockResolvedValue(eventId);
    const revealMatch = jest.fn().mockResolvedValue(undefined);
    const isEventAdmin = jest.fn().mockResolvedValue(isAdmin);
    const controller = new MatchController(
      { getEventIdOfMatch, revealMatch } as unknown as MatchService,
      { isEventAdmin } as unknown as EventService,
    );
    return { controller, revealMatch, isEventAdmin };
  }

  async function revealError(eventId: string | undefined, isAdmin: boolean) {
    const { controller, revealMatch } = setup(eventId, isAdmin);
    const error = await controller
      .revealMatch("match", "user")
      .catch((caught: unknown) => caught);
    expect(revealMatch).not.toHaveBeenCalled();
    return error;
  }

  it("answers a non-admin exactly like an unknown match", async () => {
    const hidden = await revealError("event", false);
    const unknown = await revealError(undefined, false);
    expect(hidden).toBeInstanceOf(NotFoundException);
    expect(unknown).toBeInstanceOf(NotFoundException);
    expect((hidden as NotFoundException).getResponse()).toEqual(
      (unknown as NotFoundException).getResponse(),
    );
  });

  it("lets an event admin reveal the match", async () => {
    const { controller, revealMatch, isEventAdmin } = setup("event", true);
    await controller.revealMatch("match", "admin");
    expect(isEventAdmin).toHaveBeenCalledWith("event", "admin");
    expect(revealMatch).toHaveBeenCalledWith("match");
  });
});
