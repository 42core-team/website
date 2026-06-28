import type { Match } from "@/app/actions/tournament-model";

export interface QueueState {
  inQueue: boolean;
  queueCount: number;
  match: Match | null;
}
