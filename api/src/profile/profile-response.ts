import type { EventState } from "../event/event-lifecycle";
import type { MatchPhase } from "../match/entites/match.entity";
import type { MatchTeamResponse } from "../match/match-response";
import type { TeamBackground, TeamImage } from "../team/team-image.service";
import type { BracketFinish } from "./profile-finish";
import type { ProfileRepo } from "./profile-repo";

export interface ProfileUserResponse {
  id: string;
  username: string;
  name: string;
  profilePicture: string | null;
  createdAt: Date;
  tags: string[];
  intra: { username: string; campusName: string | null } | null;
}

export interface ProfileTeamMemberResponse {
  id: string;
  username: string;
  name: string;
  profilePicture: string | null;
}

export interface ProfileTeamResponse {
  id: string;
  name: string;
  picture: TeamImage | null;
  background: TeamBackground | null;
  /** Only for viewers on the team: nobody else has access to it. */
  repo: ProfileRepo | null;
  starterTemplate: string | null;
  createdAt: Date;
  event: {
    id: string;
    name: string;
    state: EventState;
    startDate: Date;
    scheduledEndDate: Date;
    /** Teams in the elimination bracket; null before it is drawn. */
    bracketSize: number | null;
  };
  members: ProfileTeamMemberResponse[];
  /** From revealed bracket matches only. */
  finish: BracketFinish | null;
}

export type ProfileMatchResult = "WIN" | "LOSS" | "DRAW";

export interface ProfileMatchStats {
  unitsSpawned: number;
  coresDestroyed: number;
  damageTotal: number;
}

export interface ProfileMatchResponse {
  /** Opens the replay, so only viewers on one of the teams get it. */
  id: string | null;
  teamId: string;
  eventId: string;
  phase: MatchPhase;
  round: number;
  createdAt: Date;
  result: ProfileMatchResult;
  opponent: MatchTeamResponse | null;
  stats: ProfileMatchStats | null;
}

/** Sums over the profile's listed matches, both sides of each match. */
export interface ProfileCombatTotals {
  matches: number;
  unitsSpawned: number;
  unitsDestroyed: number;
  damageTotal: number;
  coresDestroyed: number;
  wallsDestroyed: number;
  gemsGained: number;
  tilesTraveled: number;
}

export interface ProfileResponse {
  user: ProfileUserResponse;
  teams: ProfileTeamResponse[];
  matches: ProfileMatchResponse[];
  combat: ProfileCombatTotals;
}
