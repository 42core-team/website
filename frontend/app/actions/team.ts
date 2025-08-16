"use server";

import axiosInstance, { handleError } from "@/app/actions/axios";
import { ServerActionResponse } from "@/app/actions/errors";
import { AxiosError } from "axios";
import { Match } from "@/app/actions/tournament-model";
import { QueueState } from "@/app/actions/team.model";

export interface Team {
  id: string;
  name: string;
  repo: string;
  inQueue: boolean;
  score: number;
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
  avatar?: string;
  username: string;
  profilePicture?: string;
}

export interface UserSearchResult {
  id: string;
  name: string;
  username: string;
  profilePicture?: string;
  isInvited: boolean;
}

export interface TeamInviteWithDetails {
  id: string;
  teamId: string;
  teamName: string;
  createdAt: Date;
}

export async function getQueueMatches(eventId: string) {
  return (await axiosInstance.get(`/match/queue/${eventId}/`)).data as Match[];
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
        queueScore: team.queueScore,
        createdAt: team.createdAt,
        inQueue: team.inQueue,
        updatedAt: team.updatedAt,
      }
    : null;
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
    queueScore: team.queueScore,
    inQueue: team.inQueue,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  };
}

export async function lockEvent(eventId: string) {
  return (await axiosInstance.put(`event/${eventId}/lock`)).data;
}

export async function createTeam(
  name: string,
  eventId: string,
): Promise<ServerActionResponse<Team>> {
  return await handleError(
    axiosInstance.post(`team/event/${eventId}/create`, {
      name,
    }),
  );
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
    username: member.username,
    profilePicture: member.profilePicture,
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
 * Send a team invite to a user
 * @returns boolean indicating success
 * @param eventId
 * @param userId ID of the user to invite
 */
export async function sendTeamInvite(
  eventId: string,
  userId: string,
): Promise<void> {
  await axiosInstance.post(`team/event/${eventId}/sendInvite`, {
    userToInviteId: userId,
  });
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

/**
 * Get all teams for a specific event
 * @param eventId ID of the event
 * @returns Array of teams
 */
export async function getTeamsForEvent(eventId: string): Promise<Team[]> {
  const teams = (await axiosInstance.get(`team/event/${eventId}`)).data;

  return teams.map((team: any) => ({
    id: team.id,
    name: team.name,
    repo: team.repo,
    membersCount: team.members.length,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  }));
}

export async function getTeamsForEventTable(
  eventId: string,
  searchTeamName: string | undefined = undefined,
  sortColumn:
    | "name"
    | "createdAt"
    | "membersCount"
    | "queueScore"
    | undefined = "name",
  sortDirection: "asc" | "desc" = "asc",
) {
  const teams = (
    await axiosInstance.get(`team/event/${eventId}/`, {
      params: {
        searchName: searchTeamName,
        sortBy: sortColumn,
        sortDir: sortDirection,
      },
    })
  ).data;

  return teams.map((team: any) => ({
    id: team.id,
    name: team.name,
    repo: team.repo || "",
    membersCount: team.userCount,
    queueScore: team.queueScore || 0,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  }));
}
