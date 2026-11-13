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
