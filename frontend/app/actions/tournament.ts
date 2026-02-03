"use server";

import type { ServerActionResponse } from "@/app/actions/errors";
import type { Match, MatchLogs } from "@/app/actions/tournament-model";
import axiosInstance, { handleError } from "@/app/actions/axios";

export async function getSwissMatches(eventId: string, adminReveal: boolean) {
  const params = new URLSearchParams();
  if (adminReveal) {
    params.append("adminRevealQuery", "true");
  }
  return (await axiosInstance.get(`/match/swiss/${eventId}`, { params }))
    .data as Match[];
}

export async function startSwissMatches(eventId: string) {
  return (await axiosInstance.put(`/match/swiss/${eventId}`)).data;
}

export async function startTournamentMatches(eventId: string) {
  return (await axiosInstance.put(`/match/tournament/${eventId}`)).data;
}

export async function getTournamentTeamCount(eventId: string) {
  return (
    await axiosInstance.get<number>(`/match/tournament/${eventId}/teamCount`)
  ).data;
}

export async function getTournamentMatches(
  eventId: string,
  adminReveal: boolean,
) {
  const params = new URLSearchParams();
  if (adminReveal) {
    params.append("adminRevealQuery", "true");
  }
  return (await axiosInstance.get(`/match/tournament/${eventId}`, { params }))
    .data as Match[];
}

export async function getLogsOfMatch(
  matchId: string,
): Promise<ServerActionResponse<MatchLogs>> {
  return handleError(axiosInstance.get<MatchLogs>(`/match/logs/${matchId}`));
}

export async function revealMatch(
  matchId: string,
): Promise<ServerActionResponse<Match>> {
  return handleError(axiosInstance.put<Match>(`/match/reveal/${matchId}`));
}

export async function getMatchById(
  matchId: string,
): Promise<ServerActionResponse<Match>> {
  return handleError(axiosInstance.get<Match>(`/match/${matchId}`));
}

export async function getMatchesForTeam(
  teamId: string,
): Promise<Match[]> {
  return (await axiosInstance.get(`/match/team/${teamId}`)).data;
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
