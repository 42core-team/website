import type { EventSettingsDto } from "../event/dtos/eventSettingsDto";
import { resolvePresetSettings } from "./preset-resolver";

/** Valid preset settings whose images skip the registry lookup. */
export const PRESET_SETTINGS = {
  minTeamSize: 1,
  maxTeamSize: 4,
  gameServerDockerImage: "registry.example.com/server:dev",
  myCoreBotDockerImage: "registry.example.com/bot:dev",
  visualizerDockerImage: "registry.example.com/visualizer:dev",
  monorepoUrl: "https://github.com/42core-team/monorepo",
  monorepoVersion: "dev",
  basePath: "bots/c/bot",
  gameConfig: '{"gridSize":20}',
  serverConfig: '{"timeoutTicks":30000}',
  schedule: {
    startOffsetDays: 7,
    startTime: "10:00",
    submissionDeadlineAfterHours: 48,
    scheduledEndAfterHours: 50,
  },
};

/** Valid settings for a new event, starting a week from now. */
export function eventSettings(
  overrides: Partial<EventSettingsDto> = {},
): EventSettingsDto {
  return {
    ...resolvePresetSettings(PRESET_SETTINGS),
    name: "Test event",
    isPrivate: true,
    ...overrides,
  };
}

/** The rest of EventService.createEvent's input, without a preset. */
export const NO_PRESET = {
  presetId: null,
  presetVersion: null,
  starterTemplates: [],
  githubInstallationId: null,
};
