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

export interface MatchTeam {
  id: string;
  name: string;
  score: number;
  queueScore: number;
  deletedAt?: string | null;
}

export interface MatchResult {
  team: {
    id: string;
    name: string;
    deletedAt?: string | null;
  };
  score: number;
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
  teams: MatchTeam[];
  winner?: MatchTeam;
  results: MatchResult[];
}

export type MatchLogs = {
  container: string;
  team: string;
  logs: string[];
}[];
