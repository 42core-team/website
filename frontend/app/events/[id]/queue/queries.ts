import type { QueueState } from "@/app/actions/team.model";
import type { Match } from "@/app/actions/tournament-model";
import axiosInstance from "@/app/actions/axios";

export function queueStateQueryKey(eventId: string) {
  return ["event", eventId, "queue-state"] as const;
}

export async function queueStateQueryFn(eventId: string): Promise<QueueState> {
  const response = await axiosInstance.get<QueueState>(
    `team/event/${eventId}/queue/state`,
  );
  return response.data;
}

export async function joinQueue(eventId: string){
  return axiosInstance.put(`team/event/${eventId}/queue/join`);
}

export async function leaveQueue(eventId: string){
  return axiosInstance.put(`team/event/${eventId}/queue/leave`);
}

export function queueMatchesQueryKey(eventId: string) {
  return ["event", eventId, "queue-matches"] as const;
}

export async function queueMatchesQueryFn(
  eventId: string,
): Promise<Match[]> {
  const response = await axiosInstance.get<Match[]>(
    `/match/queue/${eventId}/`,
  );
  return response.data;
}
