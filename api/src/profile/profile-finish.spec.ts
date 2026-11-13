import { getBracketFinish } from "./profile-finish";

describe("getBracketFinish", () => {
  it("is null without bracket matches", () => {
    expect(getBracketFinish([], 8)).toBeNull();
  });

  it("names the champion and the runner-up", () => {
    const path = [
      { round: 0, won: true },
      { round: 1, won: true },
    ];
    expect(getBracketFinish([...path, { round: 2, won: true }], 8)).toEqual({
      kind: "CHAMPION",
      roundOf: 2,
    });
    expect(getBracketFinish([...path, { round: 2, won: false }], 8)).toEqual({
      kind: "RUNNER_UP",
      roundOf: 2,
    });
  });

  it("tells the match for third place from the final", () => {
    const path = [
      { round: 0, won: true },
      { round: 1, won: false },
    ];
    expect(getBracketFinish([...path, { round: 2, won: true }], 8)).toEqual({
      kind: "THIRD",
      roundOf: 4,
    });
    expect(getBracketFinish([...path, { round: 2, won: false }], 8)).toEqual({
      kind: "FOURTH",
      roundOf: 4,
    });
  });

  it("names the round a team went out in", () => {
    expect(getBracketFinish([{ round: 0, won: false }], 16)).toEqual({
      kind: "ELIMINATED",
      roundOf: 16,
    });
    expect(
      getBracketFinish(
        [
          { round: 0, won: true },
          { round: 1, won: false },
        ],
        16,
      ),
    ).toEqual({ kind: "ELIMINATED", roundOf: 8 });
  });

  it("keeps a team in the bracket while its next result is unrevealed", () => {
    expect(getBracketFinish([{ round: 0, won: true }], 8)).toEqual({
      kind: "IN_BRACKET",
      roundOf: null,
    });
  });

  it("handles a two-team bracket", () => {
    expect(getBracketFinish([{ round: 0, won: true }], 2)).toEqual({
      kind: "CHAMPION",
      roundOf: 2,
    });
  });
});
