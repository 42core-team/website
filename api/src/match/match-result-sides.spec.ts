jest.mock("../main", () => ({ getRabbitmqConfig: jest.fn() }));

import { Logger } from "@nestjs/common";
import { MatchEntity, MatchPhase, MatchState } from "./entites/match.entity";
import { MatchEventsController } from "./match.events.controller";
import { MatchService } from "./match.service";

const GAME_ID = "123e4567-e89b-42d3-a456-42661417400b";

function setup() {
  const match = Object.assign(new MatchEntity(), {
    id: GAME_ID,
    state: MatchState.IN_PROGRESS,
    phase: MatchPhase.MANUAL,
    teams: [
      { id: "team-low", name: "Low" },
      { id: "team-high", name: "High" },
    ],
  });
  const save = jest.fn().mockImplementation((value) => Promise.resolve(value));
  const service = Object.create(MatchService.prototype) as MatchService;
  Object.assign(service, {
    logger: new Logger("test"),
    matchRepository: {
      findOne: jest.fn().mockResolvedValue(match),
      save,
    },
  });
  jest.spyOn(Logger.prototype, "log").mockImplementation();
  return { controller: new MatchEventsController(service), match };
}

function result(overrides: object = {}) {
  return {
    game_id: GAME_ID,
    team_results: [
      { id: 418, name: "High", place: 0, death_reason: 0 },
      { id: 42, name: "Low", place: 1, death_reason: 1 },
    ],
    stats: {},
    BOT_ID_MAPPING: { "42": "team-low", "418": "team-high" },
    ...overrides,
  } as never;
}

describe("storing match sides from a game result", () => {
  it("stores the website team ids of each side", async () => {
    const { controller, match } = setup();

    await controller.getNotifications(result());

    expect(match.state).toBe(MatchState.FINISHED);
    expect(match.leftTeamId).toBe("team-high");
    expect(match.rightTeamId).toBe("team-low");
  });

  it("still finishes the match when the side is unknown", async () => {
    const { controller, match } = setup();

    await controller.getNotifications(
      result({
        team_results: [
          { id: 418, name: "High", place: 0, death_reason: 0 },
          { id: 42, name: "Low", place: 1, death_reason: 4 },
        ],
      }),
    );

    expect(match.state).toBe(MatchState.FINISHED);
    expect(match.winner?.id).toBe("team-high");
    expect(match.leftTeamId).toBeNull();
    expect(match.rightTeamId).toBeNull();
  });

  it("stores nothing when the mapping names a team outside the match", async () => {
    const { controller, match } = setup();

    await controller.getNotifications(
      result({ BOT_ID_MAPPING: { "42": "stranger", "418": "team-high" } }),
    );

    expect(match.state).toBe(MatchState.FINISHED);
    expect(match.leftTeamId).toBeNull();
    expect(match.rightTeamId).toBeNull();
  });
});
