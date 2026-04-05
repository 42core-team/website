import type { AxiosInstance } from "axios";
import type {
  Event,
  EventAdmin,
  EventCreateParams,
  EventSettingsUpdate,
  EventStarterTemplate,
} from "./types/event";
import { requestData } from "./http/errors";

export function createEventsApi(http: AxiosInstance) {
  return {
    getEventById(eventId: string) {
      return requestData(http.get<Event>(`event/${eventId}`));
    },
    getEventGithubOrg(eventId: string) {
      return requestData(http.get<string>(`event/${eventId}/github-org`));
    },
    getCurrentLiveEvent() {
      return requestData(http.get<Event | undefined>("event/event/currentLiveEvent"));
    },
    isUserRegisteredForEvent(eventId: string) {
      return requestData(http.get<boolean>(`event/${eventId}/isUserRegistered`));
    },
    isEventAdmin(eventId: string) {
      return requestData(http.get<boolean>(`event/${eventId}/isEventAdmin`));
    },
    getEvents() {
      return requestData(http.get<Event[]>("event"));
    },
    getTeamsCountForEvent(eventId: string) {
      return requestData(http.get<number>(`event/${eventId}/teamsCount`));
    },
    getParticipantsCountForEvent(eventId: string) {
      return requestData(http.get<number>(`event/${eventId}/participantsCount`));
    },
    async joinEvent(eventId: string) {
      await requestData(http.put(`event/${eventId}/join`));
    },
    createEvent(eventData: EventCreateParams) {
      return requestData(http.post<Event>("event", eventData));
    },
    canUserCreateEvent() {
      return requestData(http.get<boolean>("user/canCreateEvent"));
    },
    setEventTeamsLockDate(eventId: string, lockDate: number | null) {
      return requestData(
        http.put<Event>(`event/${eventId}/lockTeamsDate`, {
          repoLockDate: lockDate,
        }),
      );
    },
    updateEventSettings(eventId: string, settings: EventSettingsUpdate) {
      return requestData(http.put<Event>(`event/${eventId}/settings`, settings));
    },
    getEventAdmins(eventId: string) {
      return requestData(http.get<EventAdmin[]>(`event/${eventId}/admins`));
    },
    async addEventAdmin(eventId: string, userId: string) {
      await requestData(http.post(`event/${eventId}/admins/${userId}`));
    },
    async removeEventAdmin(eventId: string, userId: string) {
      await requestData(http.delete(`event/${eventId}/admins/${userId}`));
    },
    getMyEvents() {
      return requestData(http.get<Event[]>("event/my"));
    },
    getStarterTemplates(eventId: string) {
      return requestData(http.get<EventStarterTemplate[]>(`event/${eventId}/templates`));
    },
    createStarterTemplate(
      eventId: string,
      data: { name: string; basePath: string; myCoreBotDockerImage: string },
    ) {
      return requestData(
        http.post<EventStarterTemplate>(`event/${eventId}/templates`, data),
      );
    },
    updateStarterTemplate(
      eventId: string,
      templateId: string,
      data: { name?: string; basePath?: string; myCoreBotDockerImage?: string },
    ) {
      return requestData(
        http.put<EventStarterTemplate>(
          `event/${eventId}/templates/${templateId}`,
          data,
        ),
      );
    },
    async deleteStarterTemplate(eventId: string, templateId: string) {
      await requestData(http.delete(`event/${eventId}/templates/${templateId}`));
    },
  };
}
