import type { Match } from '@/app/actions/tournament-model'

export interface QueueState {
  credits: number
  nextCreditAt: string | null
  match: Match | null
}
