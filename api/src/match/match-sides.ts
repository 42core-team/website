// Values of death_reason_t in the game server that decide whether a team played.
const DEATH_REASON_DISCONNECTED = 2;
const DEATH_REASON_DID_NOT_CONNECT = 4;

export interface GameTeamResult {
  id: number | string;
  death_reason?: number;
}

export interface CoreSides<TeamId> {
  leftTeamId: TeamId;
  rightTeamId: TeamId;
}

// The server only places the cores of connected teams, so a team that never
// played leaves the other core at the first position whatever the rule says.
// The stats only count what happens during play: a stat above zero means both
// cores were on the board, and without one a DISCONNECTED team may have left
// before the start.
function bothTeamsPlayed(
  teamResults: GameTeamResult[],
  stats: Record<string, unknown> | null | undefined,
): boolean {
  const reasons = teamResults.map((team) => team.death_reason);
  if (!reasons.every(Number.isInteger)) return false;
  if (reasons.includes(DEATH_REASON_DID_NOT_CONNECT)) return false;
  return (
    !reasons.includes(DEATH_REASON_DISCONNECTED) ||
    Object.values(stats ?? {}).some(
      (value) => typeof value === "number" && value > 0,
    )
  );
}

/**
 * Returns which game server team ID played on which side, or null if unknown.
 * Takes the numeric IDs from `team_results`; they are generated for each game
 * and are not website team IDs.
 *
 * Must stay in sync with `orderTeamsForCorePositions` in
 * `server/src/game/Game.cpp` in the monorepo.
 */
export function getCoreSides(
  gameId: string,
  teamResults: GameTeamResult[],
  stats?: Record<string, unknown> | null,
): CoreSides<number> | null {
  if (teamResults.length !== 2 || !/[0-9a-f]$/i.test(gameId)) return null;
  if (!bothTeamsPlayed(teamResults, stats)) return null;

  const ids = teamResults.map((team) => team.id);
  if (!ids.every((id) => Number.isInteger(id))) return null;
  const [low, high] = (ids as number[]).sort((a, b) => a - b);
  if (low === high) return null;

  const lowIsLeft = parseInt(gameId.at(-1)!, 16) < 8;
  return {
    leftTeamId: lowIsLeft ? low : high,
    rightTeamId: lowIsLeft ? high : low,
  };
}

/** Resolves the sides from a game result to website team IDs. */
export function getMatchSides(result: {
  game_id: string;
  team_results: GameTeamResult[];
  stats?: Record<string, unknown> | null;
  BOT_ID_MAPPING: Record<string, string>;
}): CoreSides<string> | null {
  const sides = getCoreSides(result.game_id, result.team_results, result.stats);
  if (!sides) return null;

  const leftTeamId = result.BOT_ID_MAPPING[sides.leftTeamId];
  const rightTeamId = result.BOT_ID_MAPPING[sides.rightTeamId];
  return leftTeamId && rightTeamId && leftTeamId !== rightTeamId
    ? { leftTeamId, rightTeamId }
    : null;
}
