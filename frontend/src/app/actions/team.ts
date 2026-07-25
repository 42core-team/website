import type { QueueMatch } from '@/app/actions/tournament-model'
import axiosInstance from '@/app/actions/axios'

export interface QueueTeamSummary {
  id: string
  name: string
  credits: number
  maxCredits: number
  creditIntervalMs: number
  nextCreditAt: string | null
}

export interface QueueOpponent {
  id: string
  name: string
}

export interface Team {
  id: string
  name: string
  repo: string
  inQueue: boolean
  credits: number
  score: number
  buchholzPoints: number
  hadBye: boolean
  locked?: boolean
  created?: string
  updated?: string
  createdAt?: Date
  updatedAt?: Date
  membersCount?: number
  tags: string[]
  description: string
  profileImageUrl: string | null
  bannerImageUrl: string | null
  winningSoundUrl: string | null
}

export interface TeamMember {
  id: string
  name: string
  isEventAdmin: boolean
  avatar?: string
  username: string
  profilePicture?: string
  intraUsername?: string
  tags: string[]
}

export interface TeamApiResponse {
  id: string
  name: string
  repo?: string | null
  inQueue?: boolean
  score?: number
  buchholzPoints?: number
  hadBye?: boolean
  locked?: boolean
  createdAt?: Date
  updatedAt?: Date
  userCount?: number
  credits?: number
  tags?: string[]
  description?: string | null
  profileImageUrl?: string | null
  bannerImageUrl?: string | null
  winningSoundUrl?: string | null
}

export type TeamAssetType = 'profile-image' | 'banner-image' | 'winning-sound'

export interface TeamMemberApiResponse {
  id: string
  name: string
  isEventAdmin: boolean
  username: string
  profilePicture?: string
  tags?: string[]
  socialAccounts?: Array<{ platform: string; username: string }>
}

export interface UserSearchResult {
  id: string
  name: string
  username: string
  profilePicture: string
  isInvited: boolean
}

export async function getQueueMatches(eventId: string) {
  return (await axiosInstance.get(`/match/queue/${eventId}/`))
    .data as QueueMatch[]
}

export async function getQueueMatchesAdmin(eventId: string) {
  return (await axiosInstance.get(`/match/queue/${eventId}/admin`))
    .data as QueueMatch[]
}

export async function getQueueSummary(
  eventId: string,
): Promise<QueueTeamSummary | null> {
  return (await axiosInstance.get(`team/event/${eventId}/queue/summary`)).data
}

export async function getQueueOpponents(
  eventId: string,
): Promise<QueueOpponent[]> {
  return (await axiosInstance.get(`team/event/${eventId}/queue/opponents`)).data
}

export async function joinQueue(eventId: string): Promise<{ matchId: string }> {
  return (await axiosInstance.put(`team/event/${eventId}/queue/join`)).data
}

export async function startDirectMatch(
  eventId: string,
  targetTeamId: string,
): Promise<{ matchId: string }> {
  return (
    await axiosInstance.post(
      `team/event/${eventId}/queue/direct/${targetTeamId}`,
    )
  ).data
}

export async function getTeamById(teamId: string): Promise<Team | null> {
  const team = (
    await axiosInstance.get<TeamApiResponse | null>(`team/${teamId}`)
  ).data

  return team ? mapTeamResponse(team) : null
}

export async function hasEventStarted(teamId: string): Promise<boolean> {
  return (await axiosInstance.get(`team/${teamId}/event-started`)).data
}

export async function getMyEventTeam(eventId: string): Promise<Team | null> {
  const team = (
    await axiosInstance.get<TeamApiResponse | null>(`team/event/${eventId}/my`)
  ).data

  if (!team) return null

  return mapTeamResponse(team)
}

export async function updateTeamCredits(
  eventId: string,
  teamId: string,
  credits: number,
): Promise<{ id: string; credits: number }> {
  return (
    await axiosInstance.put(`team/event/${eventId}/admin/${teamId}/credits`, {
      credits,
    })
  ).data
}

export async function deleteTeamAsAdmin(
  eventId: string,
  teamId: string,
): Promise<void> {
  await axiosInstance.delete(`team/event/${eventId}/admin/${teamId}`)
}

export async function updateTeamCustomization(
  eventId: string,
  description: string,
): Promise<{ description: string | null }> {
  return (
    await axiosInstance.put(`team/event/${eventId}/customization`, {
      description,
    })
  ).data
}

export async function uploadTeamAsset(
  eventId: string,
  assetType: TeamAssetType,
  file: File,
): Promise<{ assetType: TeamAssetType; url: string }> {
  const body = new FormData()
  body.append('file', file)

  return (
    await axiosInstance.put(
      `team/event/${eventId}/customization/${assetType}`,
      body,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
  ).data
}

export async function lockEvent(eventId: string) {
  return (await axiosInstance.put(`event/${eventId}/lock`)).data
}

export async function unlockEvent(eventId: string) {
  return (await axiosInstance.put(`event/${eventId}/unlock`)).data
}

/**
 * Leave a team and delete it if this was the last member
 * @param eventId ID of the event to leave the team for
 * @returns boolean indicating success
 */
export async function leaveTeam(eventId: string): Promise<void> {
  await axiosInstance.put(`team/event/${eventId}/leave`)
}

/**
 * Get all members of a team
 * @param teamId ID of the event to get team members for
 * @returns Array of team members
 */
export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  const members = (
    await axiosInstance.get<TeamMemberApiResponse[]>(`team/${teamId}/members`)
  ).data

  return members.map(mapTeamMemberResponse)
}

export function mapTeamMemberResponse(
  member: TeamMemberApiResponse,
): TeamMember {
  return {
    id: member.id,
    name: member.name,
    isEventAdmin: member.isEventAdmin,
    username: member.username,
    profilePicture: member.profilePicture,
    intraUsername: member.socialAccounts?.find((a) => a.platform === '42')
      ?.username,
    tags: member.tags ?? [],
  }
}

/**
 * Search for users that can be invited to a team
 * @param eventId ID of the event
 * @param searchQuery query string to search by username or name
 * @returns Array of user search results
 */
export async function searchUsersForInvite(
  eventId: string,
  searchQuery: string,
): Promise<UserSearchResult[]> {
  return (
    await axiosInstance.get(
      `team/event/${eventId}/searchInviteUsers/${searchQuery}`,
    )
  ).data
}

/**
 * Get pending team invites for a user
 * @returns Array of team invites with details
 * @param eventId
 */
export async function getUserPendingInvites(eventId: string): Promise<Team[]> {
  const teams = (
    await axiosInstance.get<TeamApiResponse[]>(`team/event/${eventId}/pending`)
  ).data

  return teams.map(mapTeamResponse)
}

/**
 * Accept a team invite
 * @param eventId
 * @param teamId ID of the team that sent the invite
 * @returns Object with success status and optional message
 */
export async function acceptTeamInvite(
  eventId: string,
  teamId: string,
): Promise<void> {
  await axiosInstance.put(`team/event/${eventId}/acceptInvite/${teamId}`)
}

/**
 * Decline a team invite
 * @param eventId
 * @param teamId ID of the team that sent the invite
 * @returns Object with success status and optional message
 */
export async function declineTeamInvite(
  eventId: string,
  teamId: string,
): Promise<void> {
  await axiosInstance.delete(`team/event/${eventId}/declineInvite/${teamId}`)
}

export async function getTeamsForEventTable(
  eventId: string,
  searchTeamName: string | undefined = undefined,
  sortColumn:
    | 'name'
    | 'createdAt'
    | 'membersCount'
    | 'score'
    | 'buchholzPoints'
    | undefined = 'name',
  sortDirection: 'asc' | 'desc' = 'asc',
  adminReveal: boolean = false,
): Promise<Team[]> {
  const teams = (
    await axiosInstance.get<TeamApiResponse[]>(`team/event/${eventId}/`, {
      params: {
        searchName: searchTeamName,
        sortBy: sortColumn,
        sortDir: sortDirection,
        adminRevealQuery: adminReveal,
      },
    })
  ).data

  return teams.map(mapTeamResponse)
}

export function mapTeamResponse(team: TeamApiResponse): Team {
  return {
    id: team.id,
    name: team.name,
    repo: team.repo ?? '',
    inQueue: team.inQueue ?? false,
    score: team.score ?? 0,
    buchholzPoints: team.buchholzPoints ?? 0,
    hadBye: team.hadBye ?? false,
    locked: team.locked,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
    membersCount: team.userCount,
    credits: team.credits ?? 0,
    tags: team.tags ?? [],
    description: team.description ?? '',
    profileImageUrl: team.profileImageUrl ?? null,
    bannerImageUrl: team.bannerImageUrl ?? null,
    winningSoundUrl: team.winningSoundUrl ?? null,
  }
}
