"use server";

import type { ServerActionResponse } from "@/app/actions/errors";
import type {
  QueueState as BackendQueueState,
  Team as BackendTeam,
  TeamMember as BackendTeamMember,
  TeamInviteUserSearchResult as BackendUserSearchResult,
} from "@/lib/backend/types/team";
import type { Match } from "@/lib/backend/types/tournament";
import { toActionError } from "@/lib/backend/http/errors";
import { serverTeamsApi } from "@/lib/backend/server";

export interface QueueState extends BackendQueueState {}
export interface Team extends BackendTeam {}
export interface TeamMember extends BackendTeamMember {}
export interface UserSearchResult extends BackendUserSearchResult {}

export async function getQueueMatches(eventId: string): Promise<Match[]> {
  return await serverTeamsApi.getQueueMatches(eventId);
}

export async function getQueueMatchesAdmin(eventId: string): Promise<Match[]> {
  return await serverTeamsApi.getQueueMatchesAdmin(eventId);
}

export async function getQueueState(eventId: string): Promise<QueueState> {
  return await serverTeamsApi.getQueueState(eventId);
}

export async function joinQueue(
  eventId: string,
): Promise<ServerActionResponse<void>> {
  try {
    await serverTeamsApi.joinQueue(eventId);
    return undefined;
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function getTeamById(teamId: string): Promise<Team | null> {
  return await serverTeamsApi.getTeamById(teamId);
}

export async function hasEventStarted(teamId: string): Promise<boolean> {
  return await serverTeamsApi.hasEventStarted(teamId);
}

export async function getMyEventTeam(eventId: string): Promise<Team | null> {
  return await serverTeamsApi.getMyEventTeam(eventId);
}

export async function lockEvent(
  eventId: string,
): Promise<ServerActionResponse<void>> {
  try {
    await serverTeamsApi.lockEvent(eventId);
    return undefined;
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function unlockEvent(
  eventId: string,
): Promise<ServerActionResponse<void>> {
  try {
    await serverTeamsApi.unlockEvent(eventId);
    return undefined;
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function leaveTeam(
  eventId: string,
): Promise<ServerActionResponse<void>> {
  try {
    await serverTeamsApi.leaveTeam(eventId);
    return undefined;
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  return await serverTeamsApi.getTeamMembers(teamId);
}

export async function searchUsersForInvite(
  eventId: string,
  searchQuery: string,
): Promise<UserSearchResult[]> {
  return await serverTeamsApi.searchUsersForInvite(eventId, searchQuery);
}

export async function getUserPendingInvites(eventId: string): Promise<Team[]> {
  return await serverTeamsApi.getUserPendingInvites(eventId);
}

export async function acceptTeamInvite(
  eventId: string,
  teamId: string,
): Promise<ServerActionResponse<void>> {
  try {
    await serverTeamsApi.acceptTeamInvite(eventId, teamId);
    return undefined;
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function declineTeamInvite(
  eventId: string,
  teamId: string,
): Promise<ServerActionResponse<void>> {
  try {
    await serverTeamsApi.declineTeamInvite(eventId, teamId);
    return undefined;
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function getTeamsForEventTable(
  eventId: string,
  searchTeamName: string | undefined = undefined,
  sortColumn:
    | "name"
    | "createdAt"
    | "membersCount"
    | "score"
    | "buchholzPoints"
    | "queueScore"
    | undefined = "name",
  sortDirection: "asc" | "desc" = "asc",
  adminReveal = false,
): ReturnType<typeof serverTeamsApi.getTeamsForEventTable> {
  return await serverTeamsApi.getTeamsForEventTable(
    eventId,
    searchTeamName,
    sortColumn,
    sortDirection,
    adminReveal,
  );
}
