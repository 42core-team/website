export enum MatchPhase {
  SWISS = "SWISS",
  ELIMINATION = "ELIMINATION",
  QUEUE = "QUEUE",
}

export enum MatchState {
  PLANNED = "PLANNED",
  IN_PROGRESS = "IN_PROGRESS",
  FINISHED = "FINISHED",
}

export interface Match {
  id: string;
  round: number;
  state: MatchState;
  phase: MatchPhase;
  createdAt: string;
  updatedAt: string;
  teams: {
    id: string;
    name: string;
    score: number;
    queueScore: number;
  }[];
  winner?: {
    id: string;
    name: string;
    score: number;
    queueScore: number;
  };
}

export type MatchLogs = {
  container: string;
  team: string;
  logs: string[];
}[];
