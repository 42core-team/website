"use server";

import type { ServerActionResponse } from "@/app/actions/errors";
import type { QueueState } from "@/app/actions/team.model";
import type { Match } from "@/app/actions/tournament-model";
import axiosInstance, { handleError } from "@/app/actions/axios";

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
  createdAt?: Date;
  updatedAt?: Date;
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

export interface UserSearchResult {
  id: string;
  name: string;
  username: string;
  profilePicture: string;
  isInvited: boolean;
}

export async function getQueueMatches(eventId: string) {
  return (await axiosInstance.get(`/match/queue/${eventId}/`)).data as Match[];
}

export async function getQueueMatchesAdmin(eventId: string) {
  return (await axiosInstance.get(`/match/queue/${eventId}/admin`))
    .data as Match[];
}

export async function getQueueState(eventId: string): Promise<QueueState> {
  return (
    await axiosInstance.get<QueueState>(`team/event/${eventId}/queue/state`)
  ).data;
}

export async function joinQueue(
  eventId: string,
): Promise<ServerActionResponse<void>> {
  return await handleError(
    axiosInstance.put(`team/event/${eventId}/queue/join`),
  );
}

export async function getTeamById(teamId: string): Promise<Team | null> {
  const team = (await axiosInstance.get(`team/${teamId}`)).data;

  // TODO: directly return team object if API response is already in the correct format
  return team
    ? {
        id: team.id,
        name: team.name,
        repo: team.repo || "",
        locked: team.locked,
        score: team.score,
        buchholzPoints: team.buchholzPoints || 0,
        hadBye: team.hadBye || false,
        queueScore: team.queueScore,
        createdAt: team.createdAt,
        inQueue: team.inQueue,
        updatedAt: team.updatedAt,
      }
    : null;
}

export async function hasEventStarted(teamId: string): Promise<boolean> {
  return (await axiosInstance.get(`team/${teamId}/event-started`)).data;
}

export async function getMyEventTeam(eventId: string): Promise<Team | null> {
  const team = (await axiosInstance.get(`team/event/${eventId}/my`)).data;

  if (!team) return null;

  // TODO: directly return team object if API response is already in the correct format
  return {
    id: team.id,
    name: team.name,
    repo: team.repo || "",
    locked: team.locked,
    score: team.score,
    buchholzPoints: team.buchholzPoints || 0,
    hadBye: team.hadBye || false,
    queueScore: team.queueScore,
    inQueue: team.inQueue,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  };
}

export async function lockEvent(eventId: string) {
  return (await axiosInstance.put(`event/${eventId}/lock`)).data;
}

export async function unlockEvent(eventId: string) {
  return (await axiosInstance.put(`event/${eventId}/unlock`)).data;
}

/**
 * Leave a team and delete it if this was the last member
 * @param eventId ID of the event to leave the team for
 * @returns boolean indicating success
 */
export async function leaveTeam(
  eventId: string,
): Promise<ServerActionResponse<void>> {
  return await handleError(axiosInstance.put(`team/event/${eventId}/leave`));
}

/**
 * Get all members of a team
 * @param teamId ID of the event to get team members for
 * @returns Array of team members
 */
export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  const members: any[] = (await axiosInstance.get(`team/${teamId}/members`))
    .data;

  return members.map((member: any) => ({
    id: member.id,
    name: member.name,
    isEventAdmin: member.isEventAdmin,
    username: member.username,
    profilePicture: member.profilePicture,
    intraUsername: member.socialAccounts?.find((a: any) => a.platform === "42")
      ?.username,
  }));
}

/**
 * Search for users that can be invited to a team
 * @param eventId ID of the event
 * @param searchQuery query string to search by username or name
 * @returns Array of user search results
 */
export async function searchUsersForInvite(
  eventId: string,
  searchQuery: string,
): Promise<UserSearchResult[]> {
  return (
    await axiosInstance.get(
      `team/event/${eventId}/searchInviteUsers/${searchQuery}`,
    )
  ).data;
}

/**
 * Get pending team invites for a user
 * @returns Array of team invites with details
 * @param eventId
 */
export async function getUserPendingInvites(eventId: string): Promise<Team[]> {
  return (await axiosInstance.get(`team/event/${eventId}/pending`)).data;
}

/**
 * Accept a team invite
 * @param eventId
 * @param teamId ID of the team that sent the invite
 * @returns Object with success status and optional message
 */
export async function acceptTeamInvite(
  eventId: string,
  teamId: string,
): Promise<ServerActionResponse<void>> {
  return await handleError(
    axiosInstance.put(`team/event/${eventId}/acceptInvite/${teamId}`),
  );
}

/**
 * Decline a team invite
 * @param eventId
 * @param teamId ID of the team that sent the invite
 * @returns Object with success status and optional message
 */
export async function declineTeamInvite(
  eventId: string,
  teamId: string,
): Promise<ServerActionResponse> {
  return await handleError(
    axiosInstance.delete(`team/event/${eventId}/declineInvite/${teamId}`),
  );
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
  adminReveal: boolean = false,
) {
  const teams = (
    await axiosInstance.get(`team/event/${eventId}/`, {
      params: {
        searchName: searchTeamName,
        sortBy: sortColumn,
        sortDir: sortDirection,
        adminRevealQuery: adminReveal,
      },
    })
  ).data;

  return teams.map((team: any) => ({
    id: team.id,
    name: team.name,
    repo: team.repo || "",
    membersCount: team.userCount,
    score: team.score ?? 0,
    buchholzPoints: team.buchholzPoints ?? 0,
    hadBye: team.hadBye ?? false,
    queueScore: team.queueScore ?? 0,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  }));
}
