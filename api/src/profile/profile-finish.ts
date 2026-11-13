export type BracketFinishKind =
  "CHAMPION" | "RUNNER_UP" | "THIRD" | "FOURTH" | "ELIMINATED" | "IN_BRACKET";

export interface BracketFinish {
  kind: BracketFinishKind;
  /** Teams left in the round the team went out in (8 = quarterfinal). */
  roundOf: number | null;
}

export interface BracketMatchResult {
  round: number;
  won: boolean;
}

/**
 * Where a team finished in the elimination bracket, from its revealed bracket
 * matches only. Rounds count from 0; the last round holds the final and, when
 * there were semifinals, the match for third place between their losers.
 * `bracketSize` is the number of teams that entered round 0.
 */
export function getBracketFinish(
  matches: BracketMatchResult[],
  bracketSize: number,
): BracketFinish | null {
  if (matches.length === 0 || bracketSize < 2) return null;

  const rounds = Math.round(Math.log2(bracketSize));
  const finalRound = rounds - 1;
  const sorted = [...matches].sort((a, b) => a.round - b.round);
  const last = sorted[sorted.length - 1];

  if (last.round >= finalRound) {
    const lostSemifinal = sorted.some(
      (match) => match.round === finalRound - 1 && !match.won,
    );
    if (lostSemifinal)
      return { kind: last.won ? "THIRD" : "FOURTH", roundOf: 4 };
    return { kind: last.won ? "CHAMPION" : "RUNNER_UP", roundOf: 2 };
  }

  if (last.won) return { kind: "IN_BRACKET", roundOf: null };
  return { kind: "ELIMINATED", roundOf: 2 ** (rounds - last.round) };
}
