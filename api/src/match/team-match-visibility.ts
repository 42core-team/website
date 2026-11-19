import { In, Not, Repository } from "typeorm";
import { MatchEntity, MatchPhase, MatchState } from "./entites/match.entity";

// A match id opens its replay and details, so match lists give it only to
// members of a team that played in the match.
export function canViewTeamMatchReplay(
  viewerTeamId: string | undefined,
  matchTeamIds: string[],
): boolean {
  return viewerTeamId !== undefined && matchTeamIds.includes(viewerTeamId);
}

/**
 * Ids of the matches a team's match history lists: finished queue matches,
 * and revealed matches of every other phase but manual ones. The team pages
 * and player profiles both list exactly these.
 */
export async function findVisibleTeamMatchIds(
  matches: Repository<MatchEntity>,
  teamIds: string[],
): Promise<string[]> {
  if (teamIds.length === 0) return [];
  const teams = { id: In(teamIds) };
  const rows = await matches.find({
    select: { id: true },
    where: [
      { teams, state: MatchState.FINISHED, phase: MatchPhase.QUEUE },
      {
        teams,
        state: MatchState.FINISHED,
        isRevealed: true,
        phase: Not(MatchPhase.MANUAL),
      },
    ],
    withDeleted: true,
  });
  return rows.map((match) => match.id);
}
