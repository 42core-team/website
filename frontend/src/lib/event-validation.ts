/*
 * Team repositories are named "<event name>-<team name>-<team id>" (see
 * repositoryName in api/src/team/team.service.ts), and GitHub allows at most
 * 100 characters. Team names have at most 30 characters
 * (api/src/team/dtos/createTeamDto.ts) and team ids are 36 character UUIDs,
 * which leaves 32 characters for the event name.
 */
const GITHUB_REPO_NAME_MAX_LENGTH = 100
const TEAM_NAME_MAX_LENGTH = 30
const TEAM_ID_LENGTH = 36

export const EVENT_NAME_MAX_LENGTH =
  GITHUB_REPO_NAME_MAX_LENGTH - TEAM_NAME_MAX_LENGTH - TEAM_ID_LENGTH - 2

/** Returns what is wrong with the event name as it will be saved, or undefined. */
export function getEventNameError(value: string): string | undefined {
  if (!value.trim()) return 'Event name is required'
  if (value.length > EVENT_NAME_MAX_LENGTH)
    return `Must be at most ${EVENT_NAME_MAX_LENGTH} characters, because it becomes part of the team repository names`
  return undefined
}
