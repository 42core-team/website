import { toSettledGamblingBetSummary } from "./gambling-bet-summary";

describe("toSettledGamblingBetSummary", () => {
  it("uses the stored team ID when the predicted team was soft-deleted", () => {
    const bet = {
      predictedWinner: null,
      predictedWinnerId: "winner",
      amount: 10,
      payout: 20,
    };

    expect(toSettledGamblingBetSummary(bet, "winner")).toEqual({
      predictedWinnerId: "winner",
      amount: 10,
      payout: 20,
      net: 10,
      wasCorrect: true,
    });
  });
});
