import type { Team, TeamMember } from "@/app/actions/team";
import axiosInstance from "@/app/actions/axios";

export function myTeamQueryKey(eventId: string) {
  return ["event", eventId, "my-team"] as const;
}
export function teamMembersQueryKey(teamId: string | undefined) {
  return ["team", teamId, "members"] as const;
}
export function pendingInvitesQueryKey(eventId: string) {
  return ["event", eventId, "pending-invites"] as const;
}

export async function myTeamQueryFn(eventId: string) {
  const response = await axiosInstance.get<Team | null>(
    `/team/event/${eventId}/my`,
  );
  return response.data;
}

export async function teamMembersQueryFn(teamId: string | undefined) {
  const response = await axiosInstance.get<TeamMember[]>(
    `/team/${teamId}/members`,
  );
  return response.data;
}

export async function pendingInvitesQueryFn(eventId: string) {
  const response = await axiosInstance.get<Team[]>(
    `/team/event/${eventId}/pending`,
  );
  return response.data;
}
