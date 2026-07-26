import type { WhitelistPlatform } from '@/lib/constants/whitelist'

import axiosInstance from '@/app/actions/axios'

export interface Event {
  id: string
  startDate: string
  name: string
  description?: string
  location?: string
  endDate: string
  minTeamSize: number
  maxTeamSize: number
  currentRound: number
  type?: string
  treeFormat?: number
  githubOrg: string
  repoLockDate?: string | null
  canCreateTeam: boolean
  lockedAt: string | null
  processQueue: boolean
  maxQueueCredits: number
  queueCreditIntervalMinutes: number
  monorepoUrl?: string
  monorepoVersion?: string
  gameServerDockerImage?: string
  myCoreBotDockerImage?: string
  visualizerDockerImage?: string
  basePath?: string
  gameConfig?: string
  serverConfig?: string
  isPrivate: boolean
  githubOrgSecret?: string
  starterTemplates?: EventStarterTemplate[]
}

export interface EventStarterTemplate {
  id: string
  name: string
  basePath: string
  myCoreBotDockerImage: string
}

export async function getEventById(eventId: string): Promise<Event> {
  return (await axiosInstance.get<Event>(`event/${eventId}`)).data
}

export async function getEventGithubOrg(eventId: string): Promise<string> {
  return (await axiosInstance.get<string>(`event/${eventId}/github-org`)).data
}

export async function getCurrentLiveEvent(): Promise<Event | undefined> {
  return (
    await axiosInstance.get<Event | undefined>('event/event/currentLiveEvent')
  ).data
}

export async function isUserRegisteredForEvent(
  eventId: string,
): Promise<boolean> {
  return (await axiosInstance.get<boolean>(`event/${eventId}/isUserRegistered`))
    .data
}

export async function isEventAdmin(eventId: string): Promise<boolean> {
  return (await axiosInstance.get<boolean>(`event/${eventId}/isEventAdmin`))
    .data
}

// Get all events
export async function getEvents(): Promise<Event[]> {
  return (await axiosInstance.get('event')).data as Event[]
}

export async function getTeamsCountForEvent(eventId: string): Promise<number> {
  return (await axiosInstance.get(`event/${eventId}/teamsCount`)).data
}

// Get total participants count for an event
export async function getParticipantsCountForEvent(
  eventId: string,
): Promise<number> {
  return (await axiosInstance.get(`event/${eventId}/participantsCount`)).data
}

// Join a user to an event
export async function joinEvent(eventId: string): Promise<boolean> {
  return (await axiosInstance.put<boolean>(`event/${eventId}/join`)).data
}

// Interface for creating events
export interface EventCreateParams {
  name: string
  description?: string
  githubOrg: string
  githubOrgSecret: string
  location?: string
  startDate: number
  endDate: number
  minTeamSize: number
  maxTeamSize: number
  monorepoVersion: string
  gameServerDockerImage: string
  myCoreBotDockerImage: string
  visualizerDockerImage: string
  monorepoUrl: string
  basePath: string
  gameConfig: string
  serverConfig: string
  isPrivate: boolean
}

// Create a new event
export async function createEvent(
  eventData: EventCreateParams,
): Promise<Event> {
  return (await axiosInstance.post<Event>(`event`, eventData)).data
}

export async function canUserCreateEvent(): Promise<boolean> {
  try {
    return (await axiosInstance.get<boolean>('user/canCreateEvent')).data
  } catch {
    return false
  }
}

export async function setEventTeamsLockDate(
  eventId: string,
  lockDate: number | null,
): Promise<Event> {
  return (
    await axiosInstance.put<Event>(`event/${eventId}/lockTeamsDate`, {
      repoLockDate: lockDate,
    })
  ).data
}

export async function updateEventSettings(
  eventId: string,
  settings: {
    canCreateTeam?: boolean
    processQueue?: boolean
    maxQueueCredits?: number
    queueCreditIntervalMinutes?: number
    isPrivate?: boolean
    name?: string
    description?: string
    githubOrg?: string
    githubOrgSecret?: string
    location?: string
    startDate?: number
    endDate?: number
    minTeamSize?: number
    maxTeamSize?: number
    gameServerDockerImage?: string
    myCoreBotDockerImage?: string
    visualizerDockerImage?: string
    monorepoUrl?: string
    monorepoVersion?: string
    basePath?: string
    gameConfig?: string
    serverConfig?: string
  },
): Promise<Event> {
  return (await axiosInstance.put<Event>(`event/${eventId}/settings`, settings))
    .data
}

export async function getEventAdmins(
  eventId: string,
): Promise<
  { id: string; username: string; name: string; profilePicture?: string }[]
> {
  return (
    await axiosInstance.get<
      { id: string; username: string; name: string; profilePicture?: string }[]
    >(`event/${eventId}/admins`)
  ).data
}

export async function addEventAdmin(
  eventId: string,
  userId: string,
): Promise<void> {
  await axiosInstance.post(`event/${eventId}/admins/${userId}`)
}

export async function removeEventAdmin(
  eventId: string,
  userId: string,
): Promise<void> {
  await axiosInstance.delete(`event/${eventId}/admins/${userId}`)
}

export async function getMyEvents(): Promise<Event[]> {
  try {
    return (await axiosInstance.get('event/my')).data as Event[]
  } catch {
    return []
  }
}

export async function getStarterTemplates(
  eventId: string,
): Promise<EventStarterTemplate[]> {
  return (
    await axiosInstance.get<EventStarterTemplate[]>(
      `event/${eventId}/templates`,
    )
  ).data
}

export async function createStarterTemplate(
  eventId: string,
  data: { name: string; basePath: string; myCoreBotDockerImage: string },
): Promise<EventStarterTemplate> {
  return (
    await axiosInstance.post<EventStarterTemplate>(
      `event/${eventId}/templates`,
      data,
    )
  ).data
}

export async function updateStarterTemplate(
  eventId: string,
  templateId: string,
  data: { name?: string; basePath?: string; myCoreBotDockerImage?: string },
): Promise<EventStarterTemplate> {
  return (
    await axiosInstance.put<EventStarterTemplate>(
      `event/${eventId}/templates/${templateId}`,
      data,
    )
  ).data
}

export async function deleteStarterTemplate(
  eventId: string,
  templateId: string,
): Promise<void> {
  await axiosInstance.delete(`event/${eventId}/templates/${templateId}`)
}

export interface WhitelistEntry {
  id: string
  username: string
  platform: WhitelistPlatform
  createdAt: string
}

export async function getEventWhitelist(
  eventId: string,
): Promise<WhitelistEntry[]> {
  return (
    await axiosInstance.get<WhitelistEntry[]>(`event/${eventId}/whitelist`)
  ).data
}

export async function addToWhitelist(
  eventId: string,
  entries: { username: string; platform: WhitelistPlatform }[],
): Promise<WhitelistEntry[]> {
  return (
    await axiosInstance.post<WhitelistEntry[]>(`event/${eventId}/whitelist`, {
      entries,
    })
  ).data
}

export async function removeFromWhitelist(
  eventId: string,
  whitelistId: string,
): Promise<void> {
  await axiosInstance.delete(`event/${eventId}/whitelist/${whitelistId}`)
}

export async function bulkRemoveFromWhitelist(
  eventId: string,
  ids: string[],
): Promise<void> {
  await axiosInstance.post(`event/${eventId}/whitelist/bulk-delete`, { ids })
}
