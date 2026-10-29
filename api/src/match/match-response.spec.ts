import { instanceToPlain } from "class-transformer";
import { TeamEntity } from "../team/entities/team.entity";
import { MatchEntity, MatchPhase, MatchState } from "./entites/match.entity";
import { MatchStatsEntity } from "./entites/matchStats.entity";
import {
  isRevealablePhase,
  toHiddenMatchResponse,
  toMatchResponse,
  toVisibleMatchResponse,
} from "./match-response";

function team(id: string) {
  return Object.assign(new TeamEntity(), {
    id,
    name: `Team ${id}`,
    picture: { small: `${id}-s.webp`, large: `${id}-l.webp` },
    background: null,
    deletedAt: null,
    score: 7,
    buchholzPoints: 21,
    credits: 9,
    repo: "private-repo",
    queueScore: 1500,
  });
}

function match(overrides: Partial<MatchEntity> = {}) {
  const home = team("home");
  const away = team("away");
  return Object.assign(new MatchEntity(), {
    id: "match-id",
    round: 2,
    phase: MatchPhase.SWISS,
    state: MatchState.FINISHED,
    isRevealed: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    teams: [home, away],
    winner: home,
    results: [
      { id: "r1", team: home, score: 3 },
      { id: "r2", team: away, score: 2 },
    ],
    stats: Object.assign(new MatchStatsEntity(), {
      id: "stats-id",
      actionsExecuted: 918273,
      damageTotal: 12,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    ...overrides,
  });
}

const TEAM_KEYS = ["background", "deletedAt", "id", "name", "picture"];

describe("match responses", () => {
  it("only treats tournament phases as revealable", () => {
    expect(isRevealablePhase(MatchPhase.SWISS)).toBe(true);
    expect(isRevealablePhase(MatchPhase.ELIMINATION)).toBe(true);
    expect(isRevealablePhase(MatchPhase.QUEUE)).toBe(false);
    expect(isRevealablePhase(MatchPhase.GAMBLING)).toBe(false);
    expect(isRevealablePhase(MatchPhase.MANUAL)).toBe(false);
  });

  it("strips the id, result and completion data from a hidden match", () => {
    const plain = instanceToPlain(toHiddenMatchResponse(match()));

    expect(Object.keys(plain).sort()).toEqual([
      "createdAt",
      "isRevealed",
      "phase",
      "round",
      "state",
      "teams",
    ]);
    expect(plain.state).toBe(MatchState.PLANNED);
    expect(plain.teams).toEqual([]);
    const json = JSON.stringify(plain);
    expect(json).not.toContain("match-id");
    expect(json).not.toContain("918273");
  });

  it("leaves out the teams of hidden tournament matches", () => {
    // Elimination pairs the winners of the previous round, and the placement
    // match its losers, so the teams alone would reveal those results.
    for (const phase of [MatchPhase.SWISS, MatchPhase.ELIMINATION]) {
      const hidden = toHiddenMatchResponse(
        Object.assign(match({ phase }), { isPlacementMatch: true }),
      );
      expect(hidden.teams).toEqual([]);
      expect(JSON.stringify(hidden)).not.toMatch(/home|away/);
    }
  });

  it("keeps the teams of matches that are never revealed", () => {
    const hidden = toHiddenMatchResponse(match({ phase: MatchPhase.QUEUE }));
    expect(hidden.teams.map((entry) => entry.id)).toEqual(["home", "away"]);
    for (const entry of hidden.teams)
      expect(Object.keys(entry).sort()).toEqual(TEAM_KEYS);
  });

  it("keeps the placement flag for the bracket", () => {
    const hidden = toHiddenMatchResponse(
      Object.assign(match(), { isPlacementMatch: true }),
    );
    expect(hidden.isPlacementMatch).toBe(true);
    expect(toHiddenMatchResponse(match())).not.toHaveProperty(
      "isPlacementMatch",
    );
  });

  it("projects nested teams of a visible match without standings", () => {
    const plain = instanceToPlain(
      toVisibleMatchResponse(match({ isRevealed: true })),
    );

    expect(plain.id).toBe("match-id");
    expect(plain.winner.id).toBe("home");
    expect(plain.results).toEqual([
      { team: expect.objectContaining({ id: "home" }), score: 3 },
      { team: expect.objectContaining({ id: "away" }), score: 2 },
    ]);
    for (const entry of [
      ...plain.teams,
      plain.winner,
      ...plain.results.map((result: { team: object }) => result.team),
    ])
      expect(Object.keys(entry).sort()).toEqual(TEAM_KEYS);
    expect(plain.stats.actionsExecuted).toBe(918273);
    expect(plain.stats).not.toHaveProperty("id");
    expect(JSON.stringify(plain)).not.toMatch(
      /buchholzPoints|credits|queueScore|private-repo/,
    );
  });

  it("only shows unrevealed results in admin reveal mode", () => {
    expect(toMatchResponse(match(), false)).not.toHaveProperty("id");
    expect(toMatchResponse(match(), true)).toHaveProperty("id", "match-id");
    expect(toMatchResponse(match({ isRevealed: true }), false)).toHaveProperty(
      "winner.id",
      "home",
    );
  });

  it("does not mutate the entity", () => {
    const entity = match();
    toHiddenMatchResponse(entity);
    toVisibleMatchResponse(entity);
    expect(entity.state).toBe(MatchState.FINISHED);
    expect(entity.teams[0].score).toBe(7);
    expect(entity.results).toHaveLength(2);
  });
});
