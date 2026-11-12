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

type GameResult = Parameters<MatchEventsController["getNotifications"]>[0];

const NO_STATS: GameResult["stats"] = {
  actions_executed: 0,
  damage_deposits: 0,
  gempiles_destroyed: 0,
  damage_total: 0,
  gems_gained: 0,
  damage_walls: 0,
  damage_cores: 0,
  units_spawned: 0,
  tiles_traveled: 0,
  damage_self: 0,
  damage_units: 0,
  walls_destroyed: 0,
  gems_transferred: 0,
  units_destroyed: 0,
  cores_destroyed: 0,
  damage_opponent: 0,
};

function result(overrides: Partial<GameResult> = {}): GameResult {
  return {
    game_id: GAME_ID,
    team_results: [
      { id: 418, name: "High", place: 0, death_reason: 0 },
      { id: 42, name: "Low", place: 1, death_reason: 1 },
    ],
    stats: NO_STATS,
    BOT_ID_MAPPING: { "42": "team-low", "418": "team-high" },
    ...overrides,
  };
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
