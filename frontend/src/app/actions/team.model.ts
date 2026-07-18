import type { Match } from '@/app/actions/tournament-model'

export interface QueueState {
  inQueue: boolean
  queueCount: number
  credits: number
  isPublic: boolean
  nextCreditAt: string | null
  match: Match | null
}

export type TeamChallengeStatus =
  'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED'

export interface TeamChallenge {
  id: string
  status: TeamChallengeStatus
  createdAt: string
  respondedAt: string | null
  challenger: { id: string; name: string }
  target: { id: string; name: string; isPublic: boolean }
  matchId: string | null
}
