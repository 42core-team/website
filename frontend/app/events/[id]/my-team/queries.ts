import { browserTeamsApi } from "@/lib/backend/browser";

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
  return await browserTeamsApi.getMyEventTeam(eventId);
}

export async function teamMembersQueryFn(teamId: string | undefined) {
  if (!teamId) {
    return [];
  }

  return await browserTeamsApi.getTeamMembers(teamId);
}

export async function pendingInvitesQueryFn(eventId: string) {
  return await browserTeamsApi.getUserPendingInvites(eventId);
}
