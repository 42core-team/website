import type { QueueState } from "@/lib/backend/types/team";
import type { Match } from "@/lib/backend/types/tournament";
import { browserTeamsApi, browserTournamentApi } from "@/lib/backend/browser";

export function queueStateQueryKey(eventId: string) {
  return ["event", eventId, "queue-state"] as const;
}

export async function queueStateQueryFn(eventId: string): Promise<QueueState> {
  return await browserTeamsApi.getQueueState(eventId);
}

export async function joinQueue(eventId: string) {
  return await browserTeamsApi.joinQueue(eventId);
}

export async function leaveQueue(eventId: string) {
  return await browserTeamsApi.leaveQueue(eventId);
}

export function queueMatchesQueryKey(eventId: string) {
  return ["event", eventId, "queue-matches"] as const;
}

export async function queueMatchesQueryFn(eventId: string): Promise<Match[]> {
  return await browserTeamsApi.getQueueMatches(eventId);
}

export function matchQueryKey(matchId: string) {
  return ["match", matchId] as const;
}

export async function matchQueryFn(matchId: string): Promise<Match> {
  return await browserTournamentApi.getMatchById(matchId);
}
