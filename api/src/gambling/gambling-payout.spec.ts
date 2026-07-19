import { calculateGamblingPayouts } from "./gambling-payout";

describe("calculateGamblingPayouts", () => {
  it("pays twenty percent to the winner and weights the rest by stake", () => {
    const result = calculateGamblingPayouts(
      [
        { id: "a", amount: 30, predictedWinnerId: "winner" },
        { id: "b", amount: 10, predictedWinnerId: "winner" },
        { id: "c", amount: 60, predictedWinnerId: "loser" },
      ],
      "winner",
    );

    expect(result.totalPool).toBe(100);
    expect(result.winnerTeamPayout).toBe(20);
    expect(result.payouts.get("a")).toBe(60);
    expect(result.payouts.get("b")).toBe(20);
  });

  it("gives the pool to the winner when nobody backed them", () => {
    const result = calculateGamblingPayouts(
      [{ id: "a", amount: 7, predictedWinnerId: "loser" }],
      "winner",
    );

    expect(result.winnerTeamPayout).toBe(7);
    expect(result.payouts.size).toBe(0);
  });

  it("keeps rounding remainders in the winner payout", () => {
    const result = calculateGamblingPayouts(
      [
        { id: "a", amount: 1, predictedWinnerId: "winner" },
        { id: "b", amount: 1, predictedWinnerId: "winner" },
        { id: "c", amount: 1, predictedWinnerId: "loser" },
      ],
      "winner",
    );

    expect(
      result.winnerTeamPayout +
        [...result.payouts.values()].reduce((sum, payout) => sum + payout, 0),
    ).toBe(3);
  });
});
