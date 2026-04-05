"use server";

import type { ServerActionResponse } from "@/app/actions/errors";
import type {
  Match as BackendMatch,
  MatchLogs as BackendMatchLogs,
} from "@/lib/backend/types/tournament";
import { toActionError } from "@/lib/backend/http/errors";
import { serverTournamentApi } from "@/lib/backend/server";

export async function getSwissMatches(eventId: string, adminReveal: boolean) {
  return await serverTournamentApi.getSwissMatches(eventId, adminReveal);
}

export async function startSwissMatches(eventId: string) {
  return await serverTournamentApi.startSwissMatches(eventId);
}

export async function startTournamentMatches(eventId: string) {
  return await serverTournamentApi.startTournamentMatches(eventId);
}

export async function getTournamentTeamCount(eventId: string) {
  return await serverTournamentApi.getTournamentTeamCount(eventId);
}

export async function getTournamentMatches(
  eventId: string,
  adminReveal: boolean,
) {
  return await serverTournamentApi.getTournamentMatches(eventId, adminReveal);
}

export async function getLogsOfMatch(
  matchId: string,
): Promise<ServerActionResponse<BackendMatchLogs>> {
  try {
    return await serverTournamentApi.getLogsOfMatch(matchId);
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function revealMatch(
  matchId: string,
): Promise<ServerActionResponse<BackendMatch>> {
  try {
    return await serverTournamentApi.revealMatch(matchId);
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function revealAllMatches(
  eventId: string,
  phase: string,
): Promise<ServerActionResponse<void>> {
  try {
    await serverTournamentApi.revealAllMatches(eventId, phase);
    return undefined;
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function cleanupAllMatches(
  eventId: string,
  phase: string,
): Promise<ServerActionResponse<void>> {
  try {
    await serverTournamentApi.cleanupAllMatches(eventId, phase);
    return undefined;
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function getMatchById(
  matchId: string,
): Promise<ServerActionResponse<BackendMatch>> {
  try {
    return await serverTournamentApi.getMatchById(matchId);
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function getMatchesForTeam(
  teamId: string,
): Promise<BackendMatch[]> {
  return await serverTournamentApi.getMatchesForTeam(teamId);
}
