jest.mock("./match.service", () => ({ MatchService: class MatchService {} }));
jest.mock("../event/event.service", () => ({
  EventService: class EventService {},
}));

import { UnauthorizedException } from "@nestjs/common";
import { EventService } from "../event/event.service";
import { MatchEntity, MatchPhase, MatchState } from "./entites/match.entity";
import { MatchController } from "./match.controller";
import { MatchService } from "./match.service";

describe("match detail results", () => {
  function setup(phase: MatchPhase, isRevealed = true) {
    const match = {
      id: "match",
      phase,
      state: MatchState.FINISHED,
      isRevealed,
      teams: [{ id: "team", event: { id: "event" } }],
      winner: { id: "team" },
      results: [{ team: { id: "team" }, score: 1234 }],
    } as MatchEntity;
    const getMatchById = jest.fn().mockResolvedValue(match);
    const controller = new MatchController(
      { getMatchById } as unknown as MatchService,
      {} as EventService,
    );
    return { controller, match, getMatchById };
  }

  it.each([false, true])(
    "strips revealed QUEUE ratings with admin reveal %s",
    async (adminReveal) => {
      const { controller, match, getMatchById } = setup(MatchPhase.QUEUE);
      const response = await controller.getMatchById(
        "match",
        "user",
        adminReveal,
      );

      expect(response.results).toEqual([]);
      expect(JSON.stringify(response)).not.toContain('"score":1234');
      expect(response.winner).toEqual(match.winner);
      expect(response.state).toBe(MatchState.FINISHED);
      expect(match.results[0].score).toBe(1234);
      expect(getMatchById).toHaveBeenCalledWith(
        "match",
        expect.objectContaining({ results: { team: true } }),
        "user",
        adminReveal,
      );
    },
  );

  it("strips QUEUE ratings when an admin previews an unrevealed match", async () => {
    const { controller } = setup(MatchPhase.QUEUE, false);
    const response = await controller.getMatchById("match", "admin", true);
    expect(response.results).toEqual([]);
  });

  it.each([MatchPhase.SWISS, MatchPhase.ELIMINATION, MatchPhase.GAMBLING])(
    "preserves %s results",
    async (phase) => {
      const { controller, match } = setup(phase);
      const response = await controller.getMatchById("match", "user", false);
      expect(response).toBe(match);
      expect(response.results[0].score).toBe(1234);
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
