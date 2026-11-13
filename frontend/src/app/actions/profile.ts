import type { TeamBackground, TeamImage } from '@/app/actions/team'
import axiosInstance from '@/app/actions/axios'

export type EventStateValue =
  'REGISTRATION' | 'PLAYING' | 'SUBMISSIONS_CLOSED' | 'SHOWCASE' | 'COMPLETED'

export type ProfileMatchPhase =
  'QUEUE' | 'SWISS' | 'ELIMINATION' | 'GAMBLING' | 'MANUAL'

export type ProfileMatchResult = 'WIN' | 'LOSS' | 'DRAW'

export type BracketFinishKind =
  'CHAMPION' | 'RUNNER_UP' | 'THIRD' | 'FOURTH' | 'ELIMINATED' | 'IN_BRACKET'

export interface BracketFinish {
  kind: BracketFinishKind
  roundOf: number | null
}

export interface MatchRecord {
  wins: number
  losses: number
  draws: number
}

export interface ProfileUser {
  id: string
  username: string
  name: string
  profilePicture: string | null
  createdAt: string
  tags: string[]
  intra: { username: string; campusName: string | null } | null
}

export interface ProfileTeamMember {
  id: string
  username: string
  name: string
  profilePicture: string | null
}

export interface ProfileTeam {
  id: string
  name: string
  picture: TeamImage | null
  background: TeamBackground | null
  /** Only for teams the viewer is on. */
  repo: { name: string; url: string } | null
  starterTemplate: string | null
  createdAt: string
  event: {
    id: string
    name: string
    state: EventStateValue
    startDate: string
    scheduledEndDate: string
  }
  members: ProfileTeamMember[]
  record: MatchRecord
  swissRecord: MatchRecord
  finish: BracketFinish | null
}

export interface ProfileMatchTeam {
  id: string
  name: string
  deletedAt: string | null
  picture: TeamImage | null
  background: TeamBackground | null
}

export interface ProfileRival {
  team: ProfileMatchTeam
  eventId: string
  wins: number
  losses: number
  total: number
}

export interface ProfileActivity {
  /** First UTC day (YYYY-MM-DD) of the window, which ends today. */
  since: string
  /** Days with matches only. */
  days: Array<{ day: string; count: number }>
}

export interface ProfileSummary {
  record: MatchRecord
  /** The latest 20 results, oldest first. */
  form: Array<{
    result: ProfileMatchResult
    createdAt: string
    opponent: string | null
  }>
  streaks: {
    longestWin: number
    current: { result: ProfileMatchResult; length: number } | null
  }
  phases: Array<{ phase: ProfileMatchPhase } & MatchRecord>
  activity: ProfileActivity
  rivals: {
    nemesis: ProfileRival | null
    favourite: ProfileRival | null
    mostPlayed: ProfileRival | null
  }
}

export interface ProfileCombat {
  matches: number
  unitsSpawned: number
  unitsDestroyed: number
  damageTotal: number
  coresDestroyed: number
  wallsDestroyed: number
  gemsGained: number
  tilesTraveled: number
}

export interface UserProfile {
  user: ProfileUser
  teams: ProfileTeam[]
  summary: ProfileSummary
  combat: ProfileCombat
}

export interface ProfileMatch {
  /** Only for viewers on one of the match's teams. */
  id: string | null
  teamId: string
  eventId: string
  phase: ProfileMatchPhase
  round: number
  createdAt: string
  result: ProfileMatchResult
  opponent: ProfileMatchTeam | null
  stats: {
    unitsSpawned: number
    coresDestroyed: number
    damageTotal: number
  } | null
}

export interface ProfileMatchesPage {
  total: number
  matches: ProfileMatch[]
}

export interface ProfileMatchesQuery {
  offset: number
  limit: number
  phase?: ProfileMatchPhase
  eventId?: string
}

export const profileQueryKeys = {
  profile: (username: string) => ['profile', username.toLowerCase()] as const,
  matches: (username: string, filters: Omit<ProfileMatchesQuery, 'offset'>) =>
    ['profile', username.toLowerCase(), 'matches', filters] as const,
}

export async function getUserProfile(username: string): Promise<UserProfile> {
  return (
    await axiosInstance.get<UserProfile>(
      `profile/${encodeURIComponent(username)}`,
    )
  ).data
}

export async function getUserProfileMatches(
  username: string,
  query: ProfileMatchesQuery,
): Promise<ProfileMatchesPage> {
  return (
    await axiosInstance.get<ProfileMatchesPage>(
      `profile/${encodeURIComponent(username)}/matches`,
      { params: query },
    )
  ).data
}
