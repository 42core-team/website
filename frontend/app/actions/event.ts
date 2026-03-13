"use server";

import type { ServerActionResponse } from "@/app/actions/errors";
import axiosInstance, { handleError } from "@/app/actions/axios";

export interface Event {
  id: string;
  startDate: string;
  name: string;
  description?: string;
  location?: string;
  endDate: string;
  minTeamSize: number;
  maxTeamSize: number;
  currentRound: number;
  type?: string;
  treeFormat?: number;
  githubOrg: string;
  repoLockDate?: string;
  canCreateTeam: boolean;
  lockedAt: string | null;
  processQueue: boolean;
  monorepoUrl?: string;
  monorepoVersion?: string;
  gameServerDockerImage?: string;
  myCoreBotDockerImage?: string;
  visualizerDockerImage?: string;
  basePath?: string;
  gameConfig?: string;
  serverConfig?: string;
  isPrivate: boolean;
  githubOrgSecret?: string;
  starterTemplates?: EventStarterTemplate[];
}

export interface EventStarterTemplate {
  id: string;
  name: string;
  basePath: string;
  myCoreBotDockerImage: string;
}

export async function getEventById(
  eventId: string,
): Promise<ServerActionResponse<Event>> {
  return await handleError(axiosInstance.get(`event/${eventId}`));
}

export async function getEventGithubOrg(
  eventId: string,
): Promise<ServerActionResponse<string>> {
  return await handleError(axiosInstance.get(`event/${eventId}/github-org`));
}

export async function getCurrentLiveEvent(): Promise<
  ServerActionResponse<Event | undefined>
> {
  return await handleError(
    axiosInstance.get<Event | undefined>("event/event/currentLiveEvent"),
  );
}

export async function isUserRegisteredForEvent(
  eventId: string,
): Promise<ServerActionResponse<boolean>> {
  return await handleError(
    axiosInstance.get<boolean>(`event/${eventId}/isUserRegistered`),
  );
}

export async function isEventAdmin(
  eventId: string,
): Promise<ServerActionResponse<boolean>> {
  return await handleError(axiosInstance.get(`event/${eventId}/isEventAdmin`));
}

// Get all events
export async function getEvents(): Promise<Event[]> {
  return (await axiosInstance.get("event")).data as Event[];
}

export async function getTeamsCountForEvent(eventId: string): Promise<number> {
  return (await axiosInstance.get(`event/${eventId}/teamsCount`)).data;
}

// Get total participants count for an event
export async function getParticipantsCountForEvent(
  eventId: string,
): Promise<number> {
  return (await axiosInstance.get(`event/${eventId}/participantsCount`)).data;
}

// Join a user to an event
export async function joinEvent(eventId: string): Promise<boolean> {
  await axiosInstance.put(`event/${eventId}/join`);
  return true;
}

// Interface for creating events
interface EventCreateParams {
  name: string;
  description?: string;
  githubOrg: string;
  githubOrgSecret: string;
  location?: string;
  startDate: number;
  endDate: number;
  minTeamSize: number;
  maxTeamSize: number;
  monorepoVersion: string;
  gameServerDockerImage: string;
  myCoreBotDockerImage: string;
  visualizerDockerImage: string;
  monorepoUrl: string;
  basePath: string;
  gameConfig: string;
  serverConfig: string;
  isPrivate: boolean;
}

// Create a new event
export async function createEvent(
  eventData: EventCreateParams,
): Promise<ServerActionResponse<Event>> {
  return await handleError(axiosInstance.post<Event>(`event`, eventData));
}

export async function canUserCreateEvent(): Promise<boolean> {
  try {
    return (await axiosInstance.get<boolean>("user/canCreateEvent")).data;
  }
  catch {
    return false;
  }
}

export async function setEventTeamsLockDate(
  eventId: string,
  lockDate: number | null,
): Promise<ServerActionResponse<Event>> {
  return await handleError(
    axiosInstance.put<Event>(`event/${eventId}/lockTeamsDate`, {
      repoLockDate: lockDate,
    }),
  );
}

export async function updateEventSettings(
  eventId: string,
  settings: {
    canCreateTeam?: boolean;
    processQueue?: boolean;
    isPrivate?: boolean;
    name?: string;
    description?: string;
    githubOrg?: string;
    githubOrgSecret?: string;
    location?: string;
    startDate?: number;
    endDate?: number;
    minTeamSize?: number;
    maxTeamSize?: number;
    gameServerDockerImage?: string;
    myCoreBotDockerImage?: string;
    visualizerDockerImage?: string;
    monorepoUrl?: string;
    monorepoVersion?: string;
    basePath?: string;
    gameConfig?: string;
    serverConfig?: string;
  },
): Promise<ServerActionResponse<Event>> {
  return await handleError(
    axiosInstance.put<Event>(`event/${eventId}/settings`, settings),
  );
}

export async function getEventAdmins(
  eventId: string,
): Promise<
  ServerActionResponse<{ id: string; username: string; name: string }[]>
> {
  return await handleError(axiosInstance.get(`event/${eventId}/admins`));
}

export async function addEventAdmin(
  eventId: string,
  userId: string,
): Promise<ServerActionResponse<void>> {
  return await handleError(
    axiosInstance.post(`event/${eventId}/admins/${userId}`),
  );
}

export async function removeEventAdmin(
  eventId: string,
  userId: string,
): Promise<ServerActionResponse<void>> {
  return await handleError(
    axiosInstance.delete(`event/${eventId}/admins/${userId}`),
  );
}

export async function getMyEvents(): Promise<Event[]> {
  try {
    return (await axiosInstance.get("event/my")).data as Event[];
  }
  catch {
    return [];
  }
}

export async function getStarterTemplates(
  eventId: string,
): Promise<ServerActionResponse<EventStarterTemplate[]>> {
  return await handleError(axiosInstance.get(`event/${eventId}/templates`));
}

export async function createStarterTemplate(
  eventId: string,
  data: { name: string; basePath: string; myCoreBotDockerImage: string },
): Promise<ServerActionResponse<EventStarterTemplate>> {
  return await handleError(
    axiosInstance.post(`event/${eventId}/templates`, data),
  );
}

export async function updateStarterTemplate(
  eventId: string,
  templateId: string,
  data: { name?: string; basePath?: string; myCoreBotDockerImage?: string },
): Promise<ServerActionResponse<EventStarterTemplate>> {
  return await handleError(
    axiosInstance.put(`event/${eventId}/templates/${templateId}`, data),
  );
}

export async function deleteStarterTemplate(
  eventId: string,
  templateId: string,
): Promise<ServerActionResponse<void>> {
  return await handleError(
    axiosInstance.delete(`event/${eventId}/templates/${templateId}`),
  );
}
