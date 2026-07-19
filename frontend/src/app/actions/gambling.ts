import axiosInstance from '@/app/actions/axios'

export type GamblingPhase = 'JOINING' | 'BETTING' | 'PLAYING' | 'SETTLED'

export interface GamblingTeam {
  id: string
  name: string
}

export interface GamblingSnapshot {
  round: {
    id: string
    phase: GamblingPhase
    phaseEndsAt: string | null
    teamOne: GamblingTeam | null
    teamTwo: GamblingTeam | null
    totalPool: number
    match: {
      id: string
      state: 'PLANNED' | 'IN_PROGRESS' | 'FINISHED'
      winner: GamblingTeam | null
    } | null
  }
  entries: GamblingTeam[]
  pools: {
    teamOne: number
    teamTwo: number
  }
  myTeam:
    | (GamblingTeam & {
        credits: number
        isEntered: boolean
      })
    | null
  myBet: {
    predictedWinnerId: string
    amount: number
    payout: number
  } | null
  latestResult: {
    id: string
    teamOne: GamblingTeam | null
    teamTwo: GamblingTeam | null
    winner: GamblingTeam | null
    totalPool: number
    winnerTeamPayout: number
    matchId: string | null
    myBet: {
      predictedWinnerId: string
      amount: number
      payout: number
      net: number
      wasCorrect: boolean
    } | null
  } | null
}

export async function getGamblingSnapshot(
  eventId: string,
): Promise<GamblingSnapshot> {
  return (await axiosInstance.get(`gambling/event/${eventId}`)).data
}

export async function joinGamblingList(eventId: string): Promise<void> {
  await axiosInstance.put(`gambling/event/${eventId}/entry`)
}

export async function leaveGamblingList(eventId: string): Promise<void> {
  await axiosInstance.delete(`gambling/event/${eventId}/entry`)
}

export async function placeGamblingBet(
  eventId: string,
  predictedWinnerId: string,
  amount: number,
): Promise<void> {
  await axiosInstance.post(`gambling/event/${eventId}/bet`, {
    predictedWinnerId,
    amount,
  })
}
