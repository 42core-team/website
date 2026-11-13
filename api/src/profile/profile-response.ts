import type { EventState } from "../event/event-lifecycle";
import type { MatchPhase } from "../match/entites/match.entity";
import type { MatchTeamResponse } from "../match/match-response";
import type { TeamBackground, TeamImage } from "../team/team-image.service";
import type { BracketFinish } from "./profile-finish";
import type { ProfileRepo } from "./profile-repo";
import type { MatchRecord, ProfileMatchResult } from "./profile-summary";

export type { MatchRecord, ProfileMatchResult };

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
  };
  members: ProfileTeamMemberResponse[];
  /** From the listed matches only, like everything else on the profile. */
  record: MatchRecord;
  swissRecord: MatchRecord;
  /** From revealed bracket matches only. */
  finish: BracketFinish | null;
}

export interface ProfileRivalResponse {
  team: MatchTeamResponse;
  eventId: string;
  wins: number;
  losses: number;
  total: number;
}

export interface ProfileSummaryResponse {
  record: MatchRecord;
  /** The latest 20 results, oldest first. */
  form: Array<{
    result: ProfileMatchResult;
    createdAt: Date;
    opponent: string | null;
  }>;
  streaks: {
    longestWin: number;
    current: { result: ProfileMatchResult; length: number } | null;
  };
  phases: Array<{ phase: MatchPhase } & MatchRecord>;
  /** Matches per UTC day (YYYY-MM-DD) from `since` through today. */
  activity: { since: string; days: Array<{ day: string; count: number }> };
  rivals: {
    nemesis: ProfileRivalResponse | null;
    favourite: ProfileRivalResponse | null;
    mostPlayed: ProfileRivalResponse | null;
  };
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
  summary: ProfileSummaryResponse;
  combat: ProfileCombatTotals;
}

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

/** One page of the match history, newest first. */
export interface ProfileMatchesResponse {
  total: number;
  matches: ProfileMatchResponse[];
}
