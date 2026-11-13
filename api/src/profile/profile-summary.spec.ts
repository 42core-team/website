import { MatchPhase } from "../match/entites/match.entity";
import { summarizeMatches } from "./profile-summary";
import type { ProfileMatchRow } from "./profile-summary";

const NOW = new Date("2026-11-13T12:00:00Z");
let minute = 0;

function row(
  result: ProfileMatchRow["result"],
  overrides: Partial<ProfileMatchRow> = {},
): ProfileMatchRow {
  minute++;
  return {
    id: `m${minute}`,
    phase: MatchPhase.QUEUE,
    round: 0,
    createdAt: new Date(Date.UTC(2026, 10, 1, 0, minute)),
    teamId: "t1",
    eventId: "e1",
    opponentId: null,
    result,
    ...overrides,
  };
}

describe("summarizeMatches", () => {
  it("counts results overall, per phase and per team", () => {
    const summary = summarizeMatches(
      [
        row("WIN"),
        row("LOSS", { phase: MatchPhase.SWISS }),
        row("WIN", { phase: MatchPhase.SWISS, teamId: "t2" }),
        row("DRAW"),
      ],
      NOW,
    );
    expect(summary.record).toEqual({ wins: 2, losses: 1, draws: 1 });
    expect(summary.phases).toEqual([
      { phase: MatchPhase.QUEUE, wins: 1, losses: 0, draws: 1 },
      { phase: MatchPhase.SWISS, wins: 1, losses: 1, draws: 0 },
    ]);
    expect(summary.teams.get("t1")).toEqual({
      record: { wins: 1, losses: 1, draws: 1 },
      swiss: { wins: 0, losses: 1, draws: 0 },
    });
    expect(summary.teams.get("t2")?.swiss).toEqual({
      wins: 1,
      losses: 0,
      draws: 0,
    });
  });

  it("orders form oldest first and finds streaks in any input order", () => {
    const matches = [
      row("WIN"),
      row("WIN"),
      row("WIN"),
      row("LOSS"),
      row("WIN"),
      row("WIN"),
    ].reverse();
    const summary = summarizeMatches(matches, NOW);
    expect(summary.form.map((m) => m.result)).toEqual([
      "WIN",
      "WIN",
      "WIN",
      "LOSS",
      "WIN",
      "WIN",
    ]);
    expect(summary.streaks).toEqual({
      longestWin: 3,
      current: { result: "WIN", length: 2 },
    });
  });

  it("keeps only the latest 20 matches in the form", () => {
    const matches = Array.from({ length: 25 }, (_, i) =>
      row(i < 5 ? "LOSS" : "WIN"),
    );
    const { form } = summarizeMatches(matches, NOW);
    expect(form).toHaveLength(20);
    expect(form.every((m) => m.result === "WIN")).toBe(true);
  });

  it("counts activity per UTC day for exactly the last year", () => {
    const summary = summarizeMatches(
      [
        row("WIN", { createdAt: new Date("2026-11-13T00:30:00Z") }),
        row("WIN", { createdAt: new Date("2026-11-13T23:30:00Z") }),
        row("WIN", { createdAt: new Date("2025-11-14T00:00:00Z") }),
        // A day older than the window.
        row("WIN", { createdAt: new Date("2025-11-13T23:59:00Z") }),
      ],
      NOW,
    );
    expect(summary.activity).toEqual({
      since: "2025-11-14",
      days: [
        { day: "2025-11-14", count: 1 },
        { day: "2026-11-13", count: 2 },
      ],
    });
  });

  it("needs two meetings for a rival and breaks ties by matches played", () => {
    const summary = summarizeMatches(
      [
        row("LOSS", { opponentId: "a" }),
        row("LOSS", { opponentId: "a" }),
        row("WIN", { opponentId: "a" }),
        row("WIN", { opponentId: "b" }),
        row("WIN", { opponentId: "b" }),
        row("WIN", { opponentId: "b" }),
        row("LOSS", { opponentId: "c" }),
      ],
      NOW,
    );
    expect(summary.rivals.nemesis).toMatchObject({
      opponentId: "a",
      losses: 2,
      total: 3,
    });
    expect(summary.rivals.favourite).toMatchObject({ opponentId: "b" });
    expect(summary.rivals.mostPlayed?.total).toBe(3);
    expect(
      summarizeMatches([row("LOSS", { opponentId: "c" })], NOW).rivals.nemesis,
    ).toBeNull();
  });
});
