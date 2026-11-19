import { addPlacementMatchFlags } from "./placement-matches";

const team = (id: string) => ({ id });
const match = (round: number, a: string, b: string, winner: string | null) => ({
  round,
  teams: [team(a), team(b)],
  winner: winner ? team(winner) : null,
});

describe("addPlacementMatchFlags", () => {
  it("flags the last-round match between the semifinal losers", () => {
    const flagged = addPlacementMatchFlags([
      match(0, "a", "b", "a"),
      match(0, "c", "d", "c"),
      match(1, "a", "c", null),
      match(1, "b", "d", null),
    ]);
    expect(flagged.map((m) => !!m.isPlacementMatch)).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });

  it("flags nothing without a round before the last", () => {
    const flagged = addPlacementMatchFlags([match(0, "a", "b", "a")]);
    expect(flagged[0].isPlacementMatch).toBeUndefined();
  });
});
