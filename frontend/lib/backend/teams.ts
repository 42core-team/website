import type { AxiosInstance } from "axios";
import type {
  CreateTeamInput,
  QueueState,
  Team,
  TeamInviteInput,
  TeamInviteUserSearchResult,
  TeamMember,
} from "./types/team";
import type { Match } from "./types/tournament";
import { requestData } from "./http/errors";

interface SocialAccountDto {
  platform: string;
  username?: string;
}

interface TeamDto {
  id: string;
  name: string;
  repo?: string | null;
  locked?: boolean;
  score?: number;
  buchholzPoints?: number;
  hadBye?: boolean;
  queueScore?: number;
  inQueue?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  userCount?: number;
}

interface TeamMemberDto {
  id: string;
  name: string;
  isEventAdmin: boolean;
  username: string;
  profilePicture?: string;
  socialAccounts?: SocialAccountDto[];
}

function mapTeam(team: TeamDto | null): Team | null {
  if (!team) {
    return null;
  }

  return {
    id: team.id,
    name: team.name,
    repo: team.repo || "",
    locked: team.locked,
    score: team.score ?? 0,
    buchholzPoints: team.buchholzPoints ?? 0,
    hadBye: team.hadBye ?? false,
    queueScore: team.queueScore ?? 0,
    inQueue: team.inQueue ?? false,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
    membersCount: team.userCount,
  };
}

function mapTeamMember(member: TeamMemberDto): TeamMember {
  return {
    id: member.id,
    name: member.name,
    isEventAdmin: member.isEventAdmin,
    username: member.username,
    profilePicture: member.profilePicture,
    intraUsername: member.socialAccounts?.find(account => account.platform === "42")
      ?.username,
  };
}

export function createTeamsApi(http: AxiosInstance) {
  return {
    getQueueMatches(eventId: string) {
      return requestData(http.get<Match[]>(`/match/queue/${eventId}/`));
    },
    getQueueMatchesAdmin(eventId: string) {
      return requestData(http.get<Match[]>(`/match/queue/${eventId}/admin`));
    },
    getQueueState(eventId: string) {
      return requestData(http.get<QueueState>(`team/event/${eventId}/queue/state`));
    },
    async joinQueue(eventId: string) {
      await requestData(http.put(`team/event/${eventId}/queue/join`));
    },
    async leaveQueue(eventId: string) {
      await requestData(http.put(`team/event/${eventId}/queue/leave`));
    },
    async createTeam(eventId: string, input: CreateTeamInput) {
      await requestData(http.post(`team/event/${eventId}/create`, input));
    },
    getTeamById: async (teamId: string) => mapTeam(
      await requestData(http.get<TeamDto | null>(`team/${teamId}`)),
    ),
    hasEventStarted(teamId: string) {
      return requestData(http.get<boolean>(`team/${teamId}/event-started`));
    },
    getMyEventTeam: async (eventId: string) => mapTeam(
      await requestData(http.get<TeamDto | null>(`team/event/${eventId}/my`)),
    ),
    async lockEvent(eventId: string) {
      await requestData(http.put(`event/${eventId}/lock`));
    },
    async unlockEvent(eventId: string) {
      await requestData(http.put(`event/${eventId}/unlock`));
    },
    async leaveTeam(eventId: string) {
      await requestData(http.put(`team/event/${eventId}/leave`));
    },
    async getTeamMembers(teamId: string) {
      const members = await requestData(
        http.get<TeamMemberDto[]>(`team/${teamId}/members`),
      );
      return members.map(mapTeamMember);
    },
    searchUsersForInvite(eventId: string, searchQuery: string) {
      return requestData(
        http.get<TeamInviteUserSearchResult[]>(
          `team/event/${eventId}/searchInviteUsers/${encodeURIComponent(searchQuery)}`,
        ),
      );
    },
    async getUserPendingInvites(eventId: string) {
      const teams = await requestData(
        http.get<TeamDto[]>(`team/event/${eventId}/pending`),
      );
      return teams.map(mapTeam).filter((team): team is Team => team !== null);
    },
    async acceptTeamInvite(eventId: string, teamId: string) {
      await requestData(http.put(`team/event/${eventId}/acceptInvite/${teamId}`));
    },
    async declineTeamInvite(eventId: string, teamId: string) {
      await requestData(
        http.delete(`team/event/${eventId}/declineInvite/${teamId}`),
      );
    },
    async sendTeamInvite(eventId: string, input: TeamInviteInput) {
      await requestData(http.post(`team/event/${eventId}/sendInvite`, input));
    },
    async getTeamsForEventTable(
      eventId: string,
      searchTeamName?: string,
      sortColumn:
        | "name"
        | "createdAt"
        | "membersCount"
        | "score"
        | "buchholzPoints"
        | "queueScore"
        | undefined = "name",
      sortDirection: "asc" | "desc" = "asc",
      adminReveal = false,
    ) {
      const teams = await requestData(
        http.get<TeamDto[]>(`team/event/${eventId}/`, {
          params: {
            searchName: searchTeamName,
            sortBy: sortColumn,
            sortDir: sortDirection,
            adminRevealQuery: adminReveal,
          },
        }),
      );

      return teams.map(mapTeam).filter((team): team is Team => team !== null);
    },
  };
}
