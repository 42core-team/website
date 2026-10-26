import type { TeamBackground, TeamImage } from "../team/team-image.service";
import type { TeamEntity } from "../team/entities/team.entity";
import type { MatchStatsEntity } from "./entites/matchStats.entity";
import type { MatchEntity } from "./entites/match.entity";
import { MatchPhase, MatchState } from "./entites/match.entity";

// Matches in these phases stay hidden until an event admin reveals them.
export const REVEALABLE_PHASES: readonly MatchPhase[] = [
  MatchPhase.SWISS,
  MatchPhase.ELIMINATION,
];

export function isRevealablePhase(phase: MatchPhase): boolean {
  return REVEALABLE_PHASES.includes(phase);
}

// Teams inside matches carry identity and artwork only. Stored standings are
// cumulative and would include results that are not revealed yet.
export interface MatchTeamResponse {
  id: string;
  name: string;
  deletedAt: Date | null;
  picture: TeamImage | null;
  background: TeamBackground | null;
}

export type MatchStatsResponse = Omit<
  MatchStatsEntity,
  "id" | "match" | "createdAt" | "updatedAt"
>;

// An unrevealed match: no id (replays are public by id), result or completion
// data. Only what the bracket and round views need to place it.
export interface HiddenMatchResponse {
  round: number;
  phase: MatchPhase;
  state: MatchState.PLANNED;
  isRevealed: boolean;
  isPlacementMatch?: boolean;
  createdAt: Date;
  teams: MatchTeamResponse[];
}

export interface VisibleMatchResponse {
  id: string;
  round: number;
  phase: MatchPhase;
  state: MatchState;
  isRevealed: boolean;
  isPlacementMatch?: boolean;
  createdAt: Date;
  updatedAt: Date;
  teams: MatchTeamResponse[];
  winner: MatchTeamResponse | null;
  results: { team: MatchTeamResponse; score: number }[];
  stats: MatchStatsResponse | null;
}

export type MatchResponse = HiddenMatchResponse | VisibleMatchResponse;

export type MatchWithPlacement = MatchEntity & { isPlacementMatch?: boolean };

export function toMatchTeamResponse(
  team: Pick<
    TeamEntity,
    "id" | "name" | "deletedAt" | "picture" | "background"
  >,
): MatchTeamResponse {
  return {
    id: team.id,
    name: team.name,
    deletedAt: team.deletedAt ?? null,
    picture: team.picture ?? null,
    background: team.background ?? null,
  };
}

export function toMatchStatsResponse(
  stats: MatchStatsEntity | null | undefined,
): MatchStatsResponse | null {
  if (!stats) return null;
  return {
    actionsExecuted: stats.actionsExecuted,
    damageDeposits: stats.damageDeposits,
    gempilesDestroyed: stats.gempilesDestroyed,
    damageTotal: stats.damageTotal,
    damageSelf: stats.damageSelf,
    damageOpponent: stats.damageOpponent,
    damageUnits: stats.damageUnits,
    damageCores: stats.damageCores,
    damageWalls: stats.damageWalls,
    unitsSpawned: stats.unitsSpawned,
    unitsDestroyed: stats.unitsDestroyed,
    coresDestroyed: stats.coresDestroyed,
    wallsDestroyed: stats.wallsDestroyed,
    gemsTransferred: stats.gemsTransferred,
    tilesTraveled: stats.tilesTraveled,
    gemsGained: stats.gemsGained,
  };
}

function withPlacementFlag<T extends object>(
  response: T,
  match: MatchWithPlacement,
): T & { isPlacementMatch?: boolean } {
  return match.isPlacementMatch === undefined
    ? response
    : { ...response, isPlacementMatch: match.isPlacementMatch };
}

export function toHiddenMatchResponse(
  match: MatchWithPlacement,
): HiddenMatchResponse {
  return withPlacementFlag(
    {
      round: match.round,
      phase: match.phase,
      state: MatchState.PLANNED as const,
      isRevealed: match.isRevealed,
      createdAt: match.createdAt,
      teams: (match.teams ?? []).map(toMatchTeamResponse),
    },
    match,
  );
}

export function toVisibleMatchResponse(
  match: MatchWithPlacement,
): VisibleMatchResponse {
  return withPlacementFlag(
    {
      id: match.id,
      round: match.round,
      phase: match.phase,
      state: match.state,
      isRevealed: match.isRevealed,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
      teams: (match.teams ?? []).map(toMatchTeamResponse),
      winner: match.winner ? toMatchTeamResponse(match.winner) : null,
      results: (match.results ?? [])
        .filter((result) => result.team)
        .map((result) => ({
          team: toMatchTeamResponse(result.team),
          score: result.score,
        })),
      stats: toMatchStatsResponse(match.stats),
    },
    match,
  );
}

/**
 * Builds the response for a tournament match list. `revealAll` must only be
 * true for a verified event admin who asked for reveal mode.
 */
export function toMatchResponse(
  match: MatchWithPlacement,
  revealAll: boolean,
): MatchResponse {
  return match.isRevealed || revealAll
    ? toVisibleMatchResponse(match)
    : toHiddenMatchResponse(match);
}
