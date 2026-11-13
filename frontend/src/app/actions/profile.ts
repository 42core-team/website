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
  repo: { name: string; url: string } | null
  starterTemplate: string | null
  createdAt: string
  event: {
    id: string
    name: string
    state: EventStateValue
    startDate: string
    scheduledEndDate: string
    /** Teams in the elimination bracket; null before it is drawn. */
    bracketSize: number | null
  }
  members: ProfileTeamMember[]
  finish: BracketFinish | null
}

export interface ProfileMatchOpponent {
  id: string
  name: string
  deletedAt: string | null
  picture: TeamImage | null
  background: TeamBackground | null
}

export interface ProfileMatch {
  id: string | null
  teamId: string
  eventId: string
  phase: ProfileMatchPhase
  round: number
  createdAt: string
  result: ProfileMatchResult
  opponent: ProfileMatchOpponent | null
  stats: {
    unitsSpawned: number
    coresDestroyed: number
    damageTotal: number
  } | null
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
  matches: ProfileMatch[]
  combat: ProfileCombat
}

export async function getUserProfile(username: string): Promise<UserProfile> {
  return (
    await axiosInstance.get<UserProfile>(
      `profile/${encodeURIComponent(username)}`,
    )
  ).data
}
