import type { AxiosInstance } from "axios";
import type { Match, MatchLogs } from "./types/tournament";
import { requestData } from "./http/errors";

export function createTournamentApi(http: AxiosInstance) {
  return {
    getSwissMatches(eventId: string, adminReveal: boolean) {
      const params = new URLSearchParams();
      if (adminReveal) {
        params.append("adminRevealQuery", "true");
      }

      return requestData(http.get<Match[]>(`/match/swiss/${eventId}`, { params }));
    },
    startSwissMatches(eventId: string) {
      return requestData(http.put(`/match/swiss/${eventId}`));
    },
    startTournamentMatches(eventId: string) {
      return requestData(http.put(`/match/tournament/${eventId}`));
    },
    getTournamentTeamCount(eventId: string) {
      return requestData(http.get<number>(`/match/tournament/${eventId}/teamCount`));
    },
    getTournamentMatches(eventId: string, adminReveal: boolean) {
      const params = new URLSearchParams();
      if (adminReveal) {
        params.append("adminRevealQuery", "true");
      }

      return requestData(
        http.get<Match[]>(`/match/tournament/${eventId}`, { params }),
      );
    },
    getLogsOfMatch(matchId: string) {
      return requestData(http.get<MatchLogs>(`/match/logs/${matchId}`));
    },
    revealMatch(matchId: string) {
      return requestData(http.put<Match>(`/match/reveal/${matchId}`));
    },
    async revealAllMatches(eventId: string, phase: string) {
      await requestData(http.put<void>(`/match/reveal-all/${eventId}/${phase}`));
    },
    async cleanupAllMatches(eventId: string, phase: string) {
      await requestData(http.put<void>(`/match/cleanup-all/${eventId}/${phase}`));
    },
    getMatchById(matchId: string) {
      return requestData(http.get<Match>(`/match/${matchId}`));
    },
    getMatchesForTeam(teamId: string) {
      return requestData(http.get<Match[]>(`/match/team/${teamId}`));
    },
  };
}
