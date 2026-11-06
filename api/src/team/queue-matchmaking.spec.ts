import {
  ACTIVITY_WEIGHT,
  ELO_WEIGHT,
  rankQueueOpponents,
  REPEAT_OPPONENT_DECAY,
  REPEAT_OPPONENT_WEIGHT,
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
          matchesAgo: [],
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
          matchesAgo: [],
        },
        {
          id: "active-distant-elo",
          elo: 2000,
          lastQueueMatchAt: now,
          matchesAgo: [],
        },
      ],
      now,
    );

    expect(ranked[0].id).toBe("close-elo");
  });

  describe("repeat opponent penalty", () => {
    const scoreWith = (matchesAgo: number[]) =>
      scoreQueueOpponent(
        1200,
        { id: "opponent", elo: 1200, lastQueueMatchAt: now, matchesAgo },
        now,
      );
    const unpenalized = ELO_WEIGHT + ACTIVITY_WEIGHT;

    it("applies the full weight to the latest opponent", () => {
      expect(scoreWith([0])).toBe(unpenalized - REPEAT_OPPONENT_WEIGHT);
    });

    it("fades with each match played since", () => {
      expect(scoreWith([2])).toBe(
        unpenalized - REPEAT_OPPONENT_WEIGHT * REPEAT_OPPONENT_DECAY ** 2,
      );
    });

    it("adds up over repeated matches", () => {
      expect(scoreWith([0, 1])).toBe(
        unpenalized -
          REPEAT_OPPONENT_WEIGHT -
          REPEAT_OPPONENT_WEIGHT * REPEAT_OPPONENT_DECAY,
      );
    });

    it("lets a distant opponent beat the closest team right after a match", () => {
      const ranked = rankQueueOpponents(
        1200,
        [
          { id: "closest", elo: 1200, lastQueueMatchAt: now, matchesAgo: [0] },
          { id: "distant", elo: 3200, lastQueueMatchAt: null, matchesAgo: [] },
        ],
        now,
      );

      expect(ranked[0].id).toBe("distant");
    });

    it("lets a close opponent return before a distant one once it has faded", () => {
      const ranked = rankQueueOpponents(
        1200,
        [
          { id: "close", elo: 1200, lastQueueMatchAt: null, matchesAgo: [4] },
          { id: "distant", elo: 2000, lastQueueMatchAt: null, matchesAgo: [] },
        ],
        now,
      );

      expect(ranked[0].id).toBe("close");
    });
  });

  it("uses the team id as a deterministic tie breaker", () => {
    const ranked = rankQueueOpponents(1200, [
      {
        id: "team-b",
        elo: 1200,
        lastQueueMatchAt: null,
        matchesAgo: [],
      },
      {
        id: "team-a",
        elo: 1200,
        lastQueueMatchAt: null,
        matchesAgo: [],
      },
    ]);

    expect(ranked.map((candidate) => candidate.id)).toEqual([
      "team-a",
      "team-b",
    ]);
  });
});
