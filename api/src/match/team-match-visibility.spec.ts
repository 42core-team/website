import { canViewTeamMatchReplay } from "./team-match-visibility";

describe("canViewTeamMatchReplay", () => {
  it("allows team members to replay their matchmaking games", () => {
    expect(
      canViewTeamMatchReplay(
        { phase: "QUEUE", isRevealed: false },
        true,
      ),
    ).toBe(true);
  });

  it("keeps matchmaking replays private from other teams", () => {
    expect(
      canViewTeamMatchReplay(
        { phase: "QUEUE", isRevealed: false },
        false,
      ),
    ).toBe(false);
  });

  it("keeps the existing reveal rule for competition matches", () => {
    expect(
      canViewTeamMatchReplay(
        { phase: "SWISS", isRevealed: false },
        true,
      ),
    ).toBe(false);
    expect(
      canViewTeamMatchReplay(
        { phase: "ELIMINATION", isRevealed: true },
        false,
      ),
    ).toBe(true);
  });
});
