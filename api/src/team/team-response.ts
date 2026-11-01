import type { TeamBackground, TeamImage } from "./team-image.service";
import type { RepositoryStatus, TeamEntity } from "./entities/team.entity";

export interface TeamStanding {
  score: number;
  buchholzPoints: number;
}

// Stored team scores update as soon as a match finishes, so they can contain
// results that are not revealed yet. Responses always take their standings
// from the caller, which decides between public and stored values.
export interface TeamResponse {
  id: string;
  name: string;
  picture: TeamImage | null;
  background: TeamBackground | null;
  locked: boolean;
  repositoryStatus: RepositoryStatus;
  tournamentExcluded: boolean;
  hadBye: boolean;
  eventId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  score: number;
  buchholzPoints: number;
  tags: string[];
}

// The viewer's own team additionally carries its repository and credits.
export interface OwnTeamResponse extends TeamResponse {
  repo: string | null;
  repositoryError: string | null;
  credits: number;
}

export const EMPTY_STANDING: TeamStanding = { score: 0, buchholzPoints: 0 };

export function toTeamResponse(
  team: TeamEntity,
  standing: TeamStanding,
  tags: string[],
): TeamResponse {
  return {
    id: team.id,
    name: team.name,
    picture: team.picture ?? null,
    background: team.background ?? null,
    locked: team.locked,
    repositoryStatus: team.repositoryStatus,
    tournamentExcluded: team.tournamentExcluded,
    hadBye: team.hadBye,
    eventId: team.eventId,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
    deletedAt: team.deletedAt ?? null,
    score: standing.score,
    buchholzPoints: standing.buchholzPoints,
    tags,
  };
}

export function toOwnTeamResponse(
  team: TeamEntity,
  standing: TeamStanding,
  tags: string[],
): OwnTeamResponse {
  return {
    ...toTeamResponse(team, standing, tags),
    repo: team.repo ?? null,
    repositoryError: team.repositoryError ?? null,
    credits: team.credits,
  };
}
