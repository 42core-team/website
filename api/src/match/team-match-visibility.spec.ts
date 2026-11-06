import { canViewTeamMatchReplay } from "./team-match-visibility";

describe("canViewTeamMatchReplay", () => {
  it("allows members of a team that played in the match", () => {
    expect(canViewTeamMatchReplay("a", ["a", "b"])).toBe(true);
    expect(canViewTeamMatchReplay("b", ["a", "b"])).toBe(true);
  });

  it("keeps the match private from every other viewer", () => {
    expect(canViewTeamMatchReplay("c", ["a", "b"])).toBe(false);
    expect(canViewTeamMatchReplay(undefined, ["a", "b"])).toBe(false);
  });
});
