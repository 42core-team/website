import type { TeamImage, TeamBackground } from './team'

export enum MatchPhase {
  SWISS = 'SWISS',
  ELIMINATION = 'ELIMINATION',
  QUEUE = 'QUEUE',
  GAMBLING = 'GAMBLING',
  MANUAL = 'MANUAL',
}

export enum MatchState {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  FINISHED = 'FINISHED',
}

export interface MatchTeam {
  id: string
  picture?: TeamImage | null
  background?: TeamBackground | null
  name: string
  deletedAt?: string | null
}

// Unrevealed tournament matches come without id, completion data and results,
// so their replay cannot be looked up. Teams never carry standings here.
export interface Match {
  id?: string
  round: number
  state: MatchState
  phase: MatchPhase
  createdAt: string
  updatedAt?: string
  isRevealed: boolean
  isPlacementMatch?: boolean
  teams: MatchTeam[]
  winner?: MatchTeam | null
  results?: {
    team: MatchTeam
    score: number
  }[]
}

export interface QueueMatch {
  id?: string
  state: MatchState
  phase: MatchPhase
  createdAt: string
  teams: {
    id: string
    picture?: TeamImage | null
    background?: TeamBackground | null
    name: string
    deletedAt?: string | null
  }[]
  winner?: {
    id: string
    picture?: TeamImage | null
    background?: TeamBackground | null
    name: string
    deletedAt?: string | null
  } | null
  results?: {
    team: {
      id: string
      picture?: TeamImage | null
      background?: TeamBackground | null
      name: string
      deletedAt?: string | null
    }
    score: number
  }[]
}

export type MatchLogs = {
  container: string
  team: string
  logs: string[]
}[]
