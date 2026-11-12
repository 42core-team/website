import type { TeamBackground, TeamImage } from "./team-image.service";
import type { RepositoryStatus, TeamEntity } from "./entities/team.entity";

export interface TeamStanding {
  score: number;
  buchholzPoints: number;
}

// Each team response carries only the fields its frontend view reads. Stored
// scores and timestamps that change with match results stay out of them; the
// event team list takes its standings from the caller, which decides between
// public and stored values.

// Public team profile.
export interface TeamResponse {
  id: string;
  name: string;
  picture: TeamImage | null;
  background: TeamBackground | null;
  tags: string[];
}

// The viewer's own team additionally carries its repository state.
export interface OwnTeamResponse extends TeamResponse {
  repo: string | null;
  repositoryStatus: RepositoryStatus;
  repositoryError: string | null;
  tournamentExcluded: boolean;
}

// A team the viewer is invited to.
export interface InvitingTeamResponse {
  id: string;
  name: string;
  tags: string[];
}

// A row of the event team list and the group and bracket rankings.
export interface EventTeamResponse {
  id: string;
  name: string;
  picture: TeamImage | null;
  tags: string[];
  userCount: number;
  createdAt: Date;
  score: number;
  buchholzPoints: number;
  hadBye: boolean;
}

// Event admins also manage repositories and credits from the team list, and
// see the queue score that matchmaking pairs teams by.
export interface AdminEventTeamResponse extends EventTeamResponse {
  repositoryStatus: RepositoryStatus;
  repositoryError: string | null;
  tournamentExcluded: boolean;
  credits: number;
  queueScore: number;
}

export const EMPTY_STANDING: TeamStanding = { score: 0, buchholzPoints: 0 };

export function toTeamResponse(team: TeamEntity, tags: string[]): TeamResponse {
  return {
    id: team.id,
    name: team.name,
    picture: team.picture ?? null,
    background: team.background ?? null,
    tags,
  };
}

export function toOwnTeamResponse(
  team: TeamEntity,
  tags: string[],
): OwnTeamResponse {
  return {
    ...toTeamResponse(team, tags),
    repo: team.repo ?? null,
    repositoryStatus: team.repositoryStatus,
    repositoryError: team.repositoryError ?? null,
    tournamentExcluded: team.tournamentExcluded,
  };
}

export function toInvitingTeamResponse(
  team: TeamEntity,
  tags: string[],
): InvitingTeamResponse {
  return { id: team.id, name: team.name, tags };
}

export function toEventTeamResponse(
  team: TeamEntity,
  standing: TeamStanding,
  userCount: number,
  tags: string[],
): EventTeamResponse {
  return {
    id: team.id,
    name: team.name,
    picture: team.picture ?? null,
    tags,
    userCount,
    createdAt: team.createdAt,
    score: standing.score,
    buchholzPoints: standing.buchholzPoints,
    // A bye is public as soon as the round is paired, like the pairing itself.
    hadBye: team.hadBye,
  };
}

export function toAdminEventTeamResponse(
  team: TeamEntity,
  standing: TeamStanding,
  userCount: number,
  tags: string[],
): AdminEventTeamResponse {
  return {
    ...toEventTeamResponse(team, standing, userCount, tags),
    repositoryStatus: team.repositoryStatus,
    repositoryError: team.repositoryError ?? null,
    tournamentExcluded: team.tournamentExcluded,
    credits: team.credits,
    queueScore: team.queueScore,
  };
}
