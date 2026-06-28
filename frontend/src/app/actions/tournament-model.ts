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
  id?: string;
  round: number;
  state: MatchState;
  phase: MatchPhase;
  createdAt: string;
  updatedAt: string;
  isRevealed: boolean;
  isPlacementMatch?: boolean;
  teams: {
    id: string;
    name: string;
    score: number;
    queueScore: number;
    deletedAt?: string | null;
  }[];
  winner?: {
    id: string;
    name: string;
    score: number;
    queueScore: number;
    deletedAt?: string | null;
  };
  results: {
    team: {
      id: string;
      name: string;
      deletedAt?: string | null;
    };
    score: number;
  }[];
}

export type MatchLogs = {
  container: string;
  team: string;
  logs: string[];
}[];
