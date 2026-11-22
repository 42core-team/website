jest.mock("./match.service", () => ({ MatchService: class MatchService {} }));
jest.mock("../event/event.service", () => ({
  EventService: class EventService {},
}));

import { NotFoundException } from "@nestjs/common";
import { EventService } from "../event/event.service";
import { UserEntity } from "../user/entities/user.entity";
import { AuthorizationService, UserRole } from "../authz";
import { createAuthorizationService, principalWith } from "../authz/testing";
import { MatchEntity, MatchPhase, MatchState } from "./entites/match.entity";
import { MatchController } from "./match.controller";
import { MatchService } from "./match.service";
import { toVisibleMatchResponse } from "./match-response";

const user = principalWith("user") as UserEntity;
const admin = principalWith("admin", UserRole.ADMIN, "event") as UserEntity;

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
      {} as AuthorizationService,
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
        user,
        adminReveal,
      );

      expect("results" in response && response.results).toEqual([]);
      expect(JSON.stringify(response)).not.toContain('"score":1234');
      expect("winner" in response && response.winner).toEqual(match.winner);
      expect(response.state).toBe(MatchState.FINISHED);
      expect(match.results[0].score).toBe(1234);
      expect(getMatchResponseById).toHaveBeenCalledWith(
        "match",
        user,
        adminReveal,
      );
    },
  );

  it.each([MatchPhase.SWISS, MatchPhase.ELIMINATION, MatchPhase.GAMBLING])(
    "preserves %s results",
    async (phase) => {
      const { controller, match } = setup(phase);
      const response = await controller.getMatchById("match", user, false);
      expect(response).toBe(match);
      expect("results" in response && response.results[0].score).toBe(1234);
    },
  );
});

// Only event admins reach the manual match routes: see the decision table
// in authz/route-coverage.spec.ts.
describe("manual matches", () => {
  it("starts a manual match", async () => {
    const createManualMatch = jest.fn().mockResolvedValue({ id: "match" });
    const controller = new MatchController(
      { createManualMatch } as unknown as MatchService,
      {} as EventService,
      {} as AuthorizationService,
    );
    await expect(
      controller.createManualMatch("event", "admin", {
        teamOneId: "a",
        teamTwoId: "b",
      }),
    ).resolves.toEqual({ id: "match" });
    expect(createManualMatch).toHaveBeenCalledWith("event", "a", "b");
  });
});

describe("match reveal", () => {
  let authorization: AuthorizationService;
  beforeAll(async () => {
    authorization = await createAuthorizationService();
  });

  function setup(eventId: string | undefined) {
    const getEventIdOfMatch = jest.fn().mockResolvedValue(eventId);
    const revealMatch = jest.fn().mockResolvedValue(undefined);
    const controller = new MatchController(
      { getEventIdOfMatch, revealMatch } as unknown as MatchService,
      {} as EventService,
      authorization,
    );
    return { controller, revealMatch };
  }

  async function revealError(eventId: string | undefined, viewer: UserEntity) {
    const { controller, revealMatch } = setup(eventId);
    const error = await controller
      .revealMatch("match", viewer)
      .catch((caught: unknown) => caught);
    expect(revealMatch).not.toHaveBeenCalled();
    return error;
  }

  it("answers a non-admin exactly like an unknown match", async () => {
    const hidden = await revealError("event", user);
    const unknown = await revealError(undefined, user);
    expect(hidden).toBeInstanceOf(NotFoundException);
    expect(unknown).toBeInstanceOf(NotFoundException);
    expect((hidden as NotFoundException).getResponse()).toEqual(
      (unknown as NotFoundException).getResponse(),
    );
  });

  it("lets an event admin reveal the match", async () => {
    const { controller, revealMatch } = setup("event");
    await controller.revealMatch("match", admin);
    expect(revealMatch).toHaveBeenCalledWith("match");
  });
});
