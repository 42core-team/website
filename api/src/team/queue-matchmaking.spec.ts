import {
  ACTIVITY_WEIGHT,
  ELO_WEIGHT,
  rankQueueOpponents,
  RECENT_OPPONENT_PENALTY,
  scoreQueueOpponent,
} from "./queue-matchmaking";

describe("queue matchmaking", () => {
  const now = new Date("2026-07-18T12:00:00.000Z");

  it("uses 70 points for an exact ELO match and 30 for current activity", () => {
    expect(
      scoreQueueOpponent(
        1200,
        {
          id: "active-team",
          elo: 1200,
          lastQueueMatchAt: now,
          wasRecentOpponent: false,
        },
        now,
      ),
    ).toBe(ELO_WEIGHT + ACTIVITY_WEIGHT);
  });

  it("prioritizes ELO closeness over recent activity", () => {
    const ranked = rankQueueOpponents(
      1200,
      [
        {
          id: "close-elo",
          elo: 1200,
          lastQueueMatchAt: null,
          wasRecentOpponent: false,
        },
        {
          id: "active-distant-elo",
          elo: 2000,
          lastQueueMatchAt: now,
          wasRecentOpponent: false,
        },
      ],
      now,
    );

    expect(ranked[0].id).toBe("close-elo");
  });

  it("penalizes opponents from the team's last three queue matches", () => {
    const score = scoreQueueOpponent(
      1200,
      {
        id: "recent-opponent",
        elo: 1200,
        lastQueueMatchAt: now,
        wasRecentOpponent: true,
      },
      now,
    );

    expect(score).toBe(ELO_WEIGHT + ACTIVITY_WEIGHT - RECENT_OPPONENT_PENALTY);
  });

  it("uses the team id as a deterministic tie breaker", () => {
    const ranked = rankQueueOpponents(1200, [
      {
        id: "team-b",
        elo: 1200,
        lastQueueMatchAt: null,
        wasRecentOpponent: false,
      },
      {
        id: "team-a",
        elo: 1200,
        lastQueueMatchAt: null,
        wasRecentOpponent: false,
      },
    ]);

    expect(ranked.map((candidate) => candidate.id)).toEqual([
      "team-a",
      "team-b",
    ]);
  });
});
