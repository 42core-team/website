import { canViewTeamMatchReplay } from "./team-match-visibility";

describe("canViewTeamMatchReplay", () => {
  it("allows team members to replay their own games", () => {
    expect(canViewTeamMatchReplay(true)).toBe(true);
  });

  it("keeps every replay private from other teams", () => {
    expect(canViewTeamMatchReplay(false)).toBe(false);
  });
});
