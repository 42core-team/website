import { getCreditWagerRefund } from "./match-credit-wager";

describe("getCreditWagerRefund", () => {
  const initiatingTeam = { id: "initiating-team" };

  it("returns the one-credit stake when the initiating team wins", () => {
    expect(
      getCreditWagerRefund(
        { creditWager: 1, creditWagerTeam: initiatingTeam },
        initiatingTeam.id,
      ),
    ).toBe(1);
  });

  it("does not refund the stake when the initiating team loses", () => {
    expect(
      getCreditWagerRefund(
        { creditWager: 1, creditWagerTeam: initiatingTeam },
        "opponent-team",
      ),
    ).toBe(0);
  });

  it("does not refund regular queue matches", () => {
    expect(
      getCreditWagerRefund(
        { creditWager: 0, creditWagerTeam: null },
        initiatingTeam.id,
      ),
    ).toBe(0);
  });
});
