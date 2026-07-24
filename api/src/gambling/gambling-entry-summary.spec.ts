import { toGamblingEntrySummaries } from "./gambling-entry-summary";

describe("toGamblingEntrySummaries", () => {
  it("ignores entries whose team was soft-deleted", () => {
    expect(
      toGamblingEntrySummaries([
        { team: null },
        { team: { id: "active", name: "Active team" } },
      ]),
    ).toEqual([{ id: "active", name: "Active team" }]);
  });
});
