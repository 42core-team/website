import { getMaximumGamblingBet } from "./gambling-credits";

describe("getMaximumGamblingBet", () => {
  it("allows a team with no credits to borrow up to the event maximum", () => {
    expect(getMaximumGamblingBet(0, 8)).toBe(8);
  });

  it("includes the team's current credits in the available stake", () => {
    expect(getMaximumGamblingBet(5, 8)).toBe(13);
  });

  it("reduces the available stake when the team is already negative", () => {
    expect(getMaximumGamblingBet(-3, 8)).toBe(5);
  });

  it("does not allow another bet at or below the debt limit", () => {
    expect(getMaximumGamblingBet(-8, 8)).toBe(0);
    expect(getMaximumGamblingBet(-9, 8)).toBe(0);
  });
});
