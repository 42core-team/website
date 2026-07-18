import type { Match } from '@/app/actions/tournament-model'

export interface QueueState {
  inQueue: boolean
  queueCount: number
  credits: number
  nextCreditAt: string | null
  match: Match | null
}
