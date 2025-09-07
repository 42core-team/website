import axiosInstance from "@/app/actions/axios";
import {AxiosError} from "axios";

export interface MatchStats {
    actionsExecuted?: string;
    damageDeposits?: string;
    gempilesDestroyed?: string;
    damageTotal?: string;
    gemsGained?: string;
    damageWalls?: string;
    damageCores?: string;
    unitsSpawned?: string;
    tilesTraveled?: string;
    damageSelf?: string;
    damageUnits?: string;
    wallsDestroyed?: string;
    gemsTransferred?: string;
    unitsDestroyed?: string;
    coresDestroyed?: string;
    damageOpponent?: string;
}

export async function getGlobalStats(): Promise<MatchStats> {
    return (await axiosInstance.get<MatchStats>("stats/global")).data;
}

// New: queue matches time series
export interface QueueMatchesTimeBucket {
    bucket: string; // ISO timestamp of bucket start
    count: number;
}

export async function getQueueMatchesTimeSeries(
    eventId: string,
    interval: "minute" | "hour" | "day" = "hour",
    rangeHours = 24,
): Promise<QueueMatchesTimeBucket[]> {
    const params = new URLSearchParams({
        interval,
        rangeHours: String(rangeHours),
    });
    return (
        await axiosInstance.get<QueueMatchesTimeBucket[]>(`match/queue/${eventId}/timeseries?${params.toString()}`)
    ).data;
}
