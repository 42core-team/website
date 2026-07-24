import type { Match, MatchLogs } from '@/app/actions/tournament-model'
import axiosInstance from '@/app/actions/axios'

export async function getSwissMatches(eventId: string, adminReveal: boolean) {
  const params = new URLSearchParams()
  if (adminReveal) {
    params.append('adminRevealQuery', 'true')
  }
  return (await axiosInstance.get(`/match/swiss/${eventId}`, { params }))
    .data as Match[]
}

export async function startSwissMatches(eventId: string) {
  return (await axiosInstance.put(`/match/swiss/${eventId}`)).data
}

export async function startTournamentMatches(eventId: string) {
  return (await axiosInstance.put(`/match/tournament/${eventId}`)).data
}

export async function getTournamentTeamCount(eventId: string) {
  return (
    await axiosInstance.get<number>(`/match/tournament/${eventId}/teamCount`)
  ).data
}

export async function getTournamentMatches(
  eventId: string,
  adminReveal: boolean,
) {
  const params = new URLSearchParams()
  if (adminReveal) {
    params.append('adminRevealQuery', 'true')
  }
  return (await axiosInstance.get(`/match/tournament/${eventId}`, { params }))
    .data as Match[]
}

export async function getLogsOfMatch(matchId: string): Promise<MatchLogs> {
  return (await axiosInstance.get<MatchLogs>(`/match/logs/${matchId}`)).data
}

export async function revealMatch(matchId: string): Promise<void> {
  await axiosInstance.put<void>(`/match/reveal/${matchId}`)
}

export async function revealAllMatches(
  eventId: string,
  phase: string,
): Promise<void> {
  await axiosInstance.put<void>(`/match/reveal-all/${eventId}/${phase}`)
}

export async function cleanupAllMatches(
  eventId: string,
  phase: string,
): Promise<void> {
  await axiosInstance.put<void>(`/match/cleanup-all/${eventId}/${phase}`)
}

export async function getMatchById(matchId: string): Promise<Match> {
  return (await axiosInstance.get<Match>(`/match/${matchId}`)).data
}

export async function getMatchesForTeam(teamId: string): Promise<Match[]> {
  return (await axiosInstance.get(`/match/team/${teamId}`)).data
}

// Functions:
// General:
// - Increase round!!!!!!!!!
// -- subfunctions for: increase swiss round, increase elimination round, change phases,
// - Get current round
// - Get max rounds
//
//
// Swiss:
//
// Bracket:
// Consistent function for initial team bracket assignment
//

// Client side:
// Swiss:
// - Always Render Labels (Round number)
//
// Bracket:
// - Render Tree function (variable based on single / double elimination)
// - Display progression based on winners of initial state
