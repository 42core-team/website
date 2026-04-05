import type {
  MatchStats as BackendMatchStats,
  QueueMatchesTimeBucket as BackendQueueMatchesTimeBucket,
} from "@/lib/backend/types/stats";

import { serverStatsApi } from "@/lib/backend/server";
import "server-only";

export interface MatchStats extends BackendMatchStats {}
export interface QueueMatchesTimeBucket extends BackendQueueMatchesTimeBucket {}

export async function getGlobalStats(): Promise<MatchStats> {
  return await serverStatsApi.getGlobalStats();
}

export async function getQueueMatchesTimeSeries(
  eventId: string,
  interval: "minute" | "hour" | "day" = "hour",
  startISO?: string,
  endISO?: string,
): Promise<QueueMatchesTimeBucket[]> {
  return await serverStatsApi.getQueueMatchesTimeSeries(
    eventId,
    interval,
    startISO,
    endISO,
  );
}
