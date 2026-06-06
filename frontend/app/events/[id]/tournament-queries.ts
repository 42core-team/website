import type { Team } from "@/app/actions/team";
import type { Match } from "@/app/actions/tournament-model";
import axiosInstance from "@/app/actions/axios";

interface EventTeamResponse {
  id: string;
  name: string;
  repo?: string | null;
  userCount?: number;
  score?: number | null;
  buchholzPoints?: number | null;
  hadBye?: boolean | null;
  queueScore?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

function withAdminReveal(adminReveal: boolean) {
  return adminReveal ? { adminRevealQuery: true } : {};
}

function mapEventTeam(team: EventTeamResponse): Team {
  return {
    id: team.id,
    name: team.name,
    repo: team.repo || "",
    inQueue: false,
    membersCount: team.userCount,
    score: team.score ?? 0,
    buchholzPoints: team.buchholzPoints ?? 0,
    hadBye: team.hadBye ?? false,
    queueScore: team.queueScore ?? 0,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  };
}

export function tournamentMatchesQueryKey(
  eventId: string,
  adminReveal: boolean,
) {
  return ["event", eventId, "tournament-matches", adminReveal] as const;
}

export async function tournamentMatchesQueryFn(
  eventId: string,
  adminReveal: boolean,
): Promise<Match[]> {
  const response = await axiosInstance.get<Match[]>(`/match/tournament/${eventId}`, {
    params: withAdminReveal(adminReveal),
  });
  return response.data;
}

export function swissMatchesQueryKey(eventId: string, adminReveal: boolean) {
  return ["event", eventId, "swiss-matches", adminReveal] as const;
}

export async function swissMatchesQueryFn(
  eventId: string,
  adminReveal: boolean,
): Promise<Match[]> {
  const response = await axiosInstance.get<Match[]>(`/match/swiss/${eventId}`, {
    params: withAdminReveal(adminReveal),
  });
  return response.data;
}

export function eventTeamsStandingsQueryKey(
  eventId: string,
  adminReveal: boolean,
) {
  return ["event", eventId, "teams-standings", adminReveal] as const;
}

export async function eventTeamsStandingsQueryFn(
  eventId: string,
  adminReveal: boolean,
): Promise<Team[]> {
  const response = await axiosInstance.get<EventTeamResponse[]>(
    `team/event/${eventId}/`,
    {
      params: {
        sortBy: "score",
        sortDir: "desc",
        ...withAdminReveal(adminReveal),
      },
    },
  );

  return response.data.map(mapEventTeam);
}

export function tournamentTeamCountQueryKey(eventId: string) {
  return ["event", eventId, "tournament-team-count"] as const;
}

export async function tournamentTeamCountQueryFn(
  eventId: string,
): Promise<number> {
  const response = await axiosInstance.get<number>(
    `/match/tournament/${eventId}/teamCount`,
  );
  return response.data;
}
