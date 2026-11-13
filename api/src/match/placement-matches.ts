interface BracketMatch {
  round: number;
  winner?: { id: string } | null;
  teams?: { id: string }[];
}

/**
 * Flags the match for third place: the match in an event's last bracket round
 * between the two losers of the round before. Takes all of one event's bracket
 * matches, hidden ones included, so it does not depend on what is revealed.
 */
export function addPlacementMatchFlags<T extends BracketMatch>(
  matches: T[],
): Array<T & { isPlacementMatch?: boolean }> {
  if (matches.length === 0) return matches;

  const maxRound = Math.max(...matches.map((match) => match.round));
  if (!Number.isFinite(maxRound)) return matches;

  const previousRoundMatches = matches.filter(
    (match) => match.round === maxRound - 1,
  );
  if (previousRoundMatches.length === 0) return matches;

  const loserIds = new Set<string>();
  for (const match of previousRoundMatches) {
    const loser = match.teams?.find((team) => team.id !== match.winner?.id);
    if (loser) loserIds.add(loser.id);
  }

  if (loserIds.size < 2) return matches;

  return matches.map((match) => {
    if (match.round !== maxRound) return match;
    if (
      match.teams?.length === 2 &&
      match.teams.every((team) => loserIds.has(team.id))
    ) {
      return {
        ...match,
        isPlacementMatch: true,
      };
    }
    return match;
  });
}
