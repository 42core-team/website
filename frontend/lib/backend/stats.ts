import type { AxiosInstance } from "axios";
import type { MatchStats, QueueMatchesTimeBucket } from "./types/stats";
import { requestData } from "./http/errors";

export function createStatsApi(http: AxiosInstance) {
  return {
    getGlobalStats() {
      return requestData(http.get<MatchStats>("stats/global"));
    },
    getQueueMatchesTimeSeries(
      eventId: string,
      interval: "minute" | "hour" | "day" = "hour",
      startISO?: string,
      endISO?: string,
    ) {
      const params = new URLSearchParams({ interval });
      if (startISO) {
        params.set("start", startISO);
      }
      if (endISO) {
        params.set("end", endISO);
      }

      return requestData(
        http.get<QueueMatchesTimeBucket[]>(
          `match/queue/${eventId}/timeseries?${params.toString()}`,
        ),
      );
    },
  };
}
