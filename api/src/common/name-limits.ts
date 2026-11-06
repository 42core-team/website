/*
 * Team repositories are named "<event name>-<team name>-<team id>" (see
 * repositoryName in team/team.service.ts), and GitHub allows at most 100
 * characters. Team names have at most 30 characters and team ids are 36
 * character UUIDs, which leaves 32 characters for the event name.
 */
export const GITHUB_REPO_NAME_MAX_LENGTH = 100;
export const TEAM_NAME_MAX_LENGTH = 30;
export const TEAM_ID_LENGTH = 36;
const REPO_NAME_SEPARATORS = 2;

export const EVENT_NAME_MAX_LENGTH =
  GITHUB_REPO_NAME_MAX_LENGTH -
  TEAM_NAME_MAX_LENGTH -
  TEAM_ID_LENGTH -
  REPO_NAME_SEPARATORS;

export const EVENT_NAME_MAX_LENGTH_MESSAGE = `Event name must be at most ${EVENT_NAME_MAX_LENGTH} characters, because it becomes part of the team repository names`;
