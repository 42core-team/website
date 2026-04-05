"use server";

import type { ServerActionResponse } from "@/app/actions/errors";
import type {
  Event as BackendEvent,
  EventAdmin as BackendEventAdmin,
  EventCreateParams as BackendEventCreateParams,
  EventSettingsUpdate as BackendEventSettingsUpdate,
  EventStarterTemplate as BackendEventStarterTemplate,
} from "@/lib/backend/types/event";
import { toActionError } from "@/lib/backend/http/errors";
import { serverEventsApi } from "@/lib/backend/server";

export interface Event extends BackendEvent {}
export interface EventAdmin extends BackendEventAdmin {}
export interface EventStarterTemplate extends BackendEventStarterTemplate {}
export interface EventCreateParams extends BackendEventCreateParams {}
export interface EventSettingsUpdate extends BackendEventSettingsUpdate {}

export async function getEventById(
  eventId: string,
): Promise<ServerActionResponse<Event>> {
  try {
    return await serverEventsApi.getEventById(eventId);
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function getEventGithubOrg(
  eventId: string,
): Promise<ServerActionResponse<string>> {
  try {
    return await serverEventsApi.getEventGithubOrg(eventId);
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function getCurrentLiveEvent(): Promise<
  ServerActionResponse<Event | undefined>
> {
  try {
    return await serverEventsApi.getCurrentLiveEvent();
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function isUserRegisteredForEvent(
  eventId: string,
): Promise<ServerActionResponse<boolean>> {
  try {
    return await serverEventsApi.isUserRegisteredForEvent(eventId);
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function isEventAdmin(
  eventId: string,
): Promise<ServerActionResponse<boolean>> {
  try {
    return await serverEventsApi.isEventAdmin(eventId);
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function getEvents(): Promise<Event[]> {
  return await serverEventsApi.getEvents();
}

export async function getTeamsCountForEvent(eventId: string): Promise<number> {
  return await serverEventsApi.getTeamsCountForEvent(eventId);
}

export async function getParticipantsCountForEvent(
  eventId: string,
): Promise<number> {
  return await serverEventsApi.getParticipantsCountForEvent(eventId);
}

export async function joinEvent(eventId: string): Promise<boolean> {
  await serverEventsApi.joinEvent(eventId);
  return true;
}

export async function createEvent(
  eventData: EventCreateParams,
): Promise<ServerActionResponse<Event>> {
  try {
    return await serverEventsApi.createEvent(eventData);
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function canUserCreateEvent(): Promise<boolean> {
  try {
    return await serverEventsApi.canUserCreateEvent();
  }
  catch {
    return false;
  }
}

export async function setEventTeamsLockDate(
  eventId: string,
  lockDate: number | null,
): Promise<ServerActionResponse<Event>> {
  try {
    return await serverEventsApi.setEventTeamsLockDate(eventId, lockDate);
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function updateEventSettings(
  eventId: string,
  settings: EventSettingsUpdate,
): Promise<ServerActionResponse<Event>> {
  try {
    return await serverEventsApi.updateEventSettings(eventId, settings);
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function getEventAdmins(
  eventId: string,
): Promise<ServerActionResponse<EventAdmin[]>> {
  try {
    return await serverEventsApi.getEventAdmins(eventId);
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function addEventAdmin(
  eventId: string,
  userId: string,
): Promise<ServerActionResponse<void>> {
  try {
    await serverEventsApi.addEventAdmin(eventId, userId);
    return undefined;
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function removeEventAdmin(
  eventId: string,
  userId: string,
): Promise<ServerActionResponse<void>> {
  try {
    await serverEventsApi.removeEventAdmin(eventId, userId);
    return undefined;
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function getMyEvents(): Promise<Event[]> {
  try {
    return await serverEventsApi.getMyEvents();
  }
  catch {
    return [];
  }
}

export async function getStarterTemplates(
  eventId: string,
): Promise<ServerActionResponse<EventStarterTemplate[]>> {
  try {
    return await serverEventsApi.getStarterTemplates(eventId);
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function createStarterTemplate(
  eventId: string,
  data: { name: string; basePath: string; myCoreBotDockerImage: string },
): Promise<ServerActionResponse<EventStarterTemplate>> {
  try {
    return await serverEventsApi.createStarterTemplate(eventId, data);
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function updateStarterTemplate(
  eventId: string,
  templateId: string,
  data: { name?: string; basePath?: string; myCoreBotDockerImage?: string },
): Promise<ServerActionResponse<EventStarterTemplate>> {
  try {
    return await serverEventsApi.updateStarterTemplate(eventId, templateId, data);
  }
  catch (error) {
    return toActionError(error);
  }
}

export async function deleteStarterTemplate(
  eventId: string,
  templateId: string,
): Promise<ServerActionResponse<void>> {
  try {
    await serverEventsApi.deleteStarterTemplate(eventId, templateId);
    return undefined;
  }
  catch (error) {
    return toActionError(error);
  }
}
