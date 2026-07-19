export const ELO_WEIGHT = 70;
export const ACTIVITY_WEIGHT = 30;
export const RECENT_OPPONENT_PENALTY = 100;
export const ELO_DISTANCE_SCALE = 400;
export const ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface QueueOpponentCandidate {
  id: string;
  elo: number;
  lastQueueMatchAt: Date | null;
  wasRecentOpponent: boolean;
}

export interface ScoredQueueOpponent extends QueueOpponentCandidate {
  score: number;
}

export function scoreQueueOpponent(
  teamElo: number,
  candidate: QueueOpponentCandidate,
  now: Date = new Date(),
): number {
  let score = 0;

  const eloDistance = Math.abs(teamElo - candidate.elo);
  const eloCloseness = 1 / (1 + eloDistance / ELO_DISTANCE_SCALE);
  score += eloCloseness * ELO_WEIGHT;

  if (candidate.lastQueueMatchAt) {
    const matchAge = Math.max(
      0,
      now.getTime() - candidate.lastQueueMatchAt.getTime(),
    );
    const activity = Math.max(0, 1 - matchAge / ACTIVITY_WINDOW_MS);
    score += activity * ACTIVITY_WEIGHT;
  }

  if (candidate.wasRecentOpponent) score -= RECENT_OPPONENT_PENALTY;

  return score;
}

export function rankQueueOpponents(
  teamElo: number,
  candidates: QueueOpponentCandidate[],
  now: Date = new Date(),
): ScoredQueueOpponent[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreQueueOpponent(teamElo, candidate, now),
    }))
    .sort(
      (left, right) =>
        right.score - left.score || left.id.localeCompare(right.id),
    );
}
