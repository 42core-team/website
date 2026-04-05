import type { Match } from "./tournament";

export interface Team {
  id: string;
  name: string;
  repo: string;
  inQueue: boolean;
  score: number;
  buchholzPoints: number;
  hadBye: boolean;
  queueScore: number;
  locked?: boolean;
  created?: string;
  updated?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  membersCount?: number;
}

export interface TeamMember {
  id: string;
  name: string;
  isEventAdmin: boolean;
  avatar?: string;
  username: string;
  profilePicture?: string;
  intraUsername?: string;
}

export interface TeamInviteUserSearchResult {
  id: string;
  name: string;
  username: string;
  profilePicture: string;
  isInvited: boolean;
}

export type UserSearchResult = TeamInviteUserSearchResult;

export interface QueueState {
  inQueue: boolean;
  queueCount: number;
  match: Match | null;
}

export interface CreateTeamInput {
  name: string;
  starterTemplateId?: string;
}

export interface TeamInviteInput {
  userToInviteId: string;
}
