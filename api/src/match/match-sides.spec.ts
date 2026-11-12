import { getCoreSides, getMatchSides } from "./match-sides";

const GAME_ID = "123e4567-e89b-42d3-a456-426614174003";
const DISCONNECTED = 2;
const DID_NOT_CONNECT = 4;

function played(id: number | string, death_reason = 0) {
  return { id, death_reason };
}

const TEAMS = [played(42), played(418, 1)];

describe("getCoreSides", () => {
  it.each([
    ["3", 42, 418],
    ["7", 42, 418],
    ["8", 418, 42],
    ["b", 418, 42],
    ["F", 418, 42],
  ])("game id ending in %s", (ending, leftTeamId, rightTeamId) => {
    expect(getCoreSides(`game-${ending}`, TEAMS)).toEqual({
      leftTeamId,
      rightTeamId,
    });
  });

  it("uses the sample message from the game server", () => {
    expect(
      getCoreSides(GAME_ID, [
        { id: 418, death_reason: 1 },
        { id: 42, death_reason: 0 },
      ]),
    ).toEqual({ leftTeamId: 42, rightTeamId: 418 });
  });

  it.each(["3", "b"])(
    "ignores the order of team_results for an id ending in %s",
    (ending) => {
      const gameId = `game-${ending}`;
      expect(getCoreSides(gameId, [...TEAMS].reverse())).toEqual(
        getCoreSides(gameId, TEAMS),
      );
    },
  );

  it("does not reorder the given results", () => {
    const teams = [played(418), played(42)];
    getCoreSides(GAME_ID, teams);
    expect(teams.map((team) => team.id)).toEqual([418, 42]);
  });

  it("accepts team id 0", () => {
    expect(getCoreSides("game-3", [played(5), played(0)])).toEqual({
      leftTeamId: 0,
      rightTeamId: 5,
    });
  });

  it.each([
    ["an empty game id", "", TEAMS],
    ["a non-hex ending", "bad-id-z", TEAMS],
    ["a single team", GAME_ID, [played(42)]],
    ["three teams", GAME_ID, [played(42), played(418), played(7)]],
    ["no teams", GAME_ID, []],
    [
      "a team that did not connect",
      GAME_ID,
      [played(42, DID_NOT_CONNECT), played(418)],
    ],
    ["duplicate ids", GAME_ID, [played(42), played(42)]],
    ["ids that are not numeric", GAME_ID, [played("uuid-a"), played("uuid-b")]],
    ["numeric strings", GAME_ID, [played("42"), played("418")]],
    ["a missing death reason", GAME_ID, [{ id: 42 }, played(418)]],
  ])("is unknown for %s", (_case, gameId, teams) => {
    expect(getCoreSides(gameId, teams)).toBeNull();
  });

  describe("a disconnected team", () => {
    const teams = [played(42, DISCONNECTED), played(418)];

    it("is known once the stats show the game ran", () => {
      expect(getCoreSides("game-3", teams, { actions_executed: 1 })).toEqual({
        leftTeamId: 42,
        rightTeamId: 418,
      });
    });

    it.each([
      ["empty stats", {}],
      ["all-zero stats", { actions_executed: 0, damage_total: 0 }],
      ["no stats", undefined],
    ])("is unknown with %s", (_case, stats) => {
      expect(getCoreSides("game-3", teams, stats)).toBeNull();
    });
  });

  it("does not need stats when both teams played to the end", () => {
    expect(getCoreSides("game-3", TEAMS, {})).not.toBeNull();
  });
});

describe("getMatchSides", () => {
  const BOT_ID_MAPPING = { "42": "team-low", "418": "team-high" };

  it("resolves the sides to website team ids", () => {
    expect(
      getMatchSides({
        game_id: "game-b",
        team_results: TEAMS,
        BOT_ID_MAPPING,
      }),
    ).toEqual({ leftTeamId: "team-high", rightTeamId: "team-low" });
  });

  it("orders by game server id, not by website team id", () => {
    expect(
      getMatchSides({
        game_id: "game-3",
        team_results: TEAMS,
        BOT_ID_MAPPING: { "42": "zzz-team", "418": "aaa-team" },
      }),
    ).toEqual({ leftTeamId: "zzz-team", rightTeamId: "aaa-team" });
  });

  it("is unknown when a team is missing from the mapping", () => {
    expect(
      getMatchSides({
        game_id: "game-3",
        team_results: TEAMS,
        BOT_ID_MAPPING: { "42": "team-low" },
      }),
    ).toBeNull();
  });

  it("is unknown when both ids map to the same team", () => {
    expect(
      getMatchSides({
        game_id: "game-3",
        team_results: TEAMS,
        BOT_ID_MAPPING: { "42": "team-low", "418": "team-low" },
      }),
    ).toBeNull();
  });

  it("is unknown for the simulated results that use website team ids", () => {
    expect(
      getMatchSides({
        game_id: "game-3",
        team_results: [played("team-a"), played("team-b")],
        BOT_ID_MAPPING: { "team-a": "team-a", "team-b": "team-b" },
      }),
    ).toBeNull();
  });
});
