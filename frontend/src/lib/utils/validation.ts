/**
 * Validation utilities for form inputs
 */

/**
 * Validates team name format: letters, numbers, underscores, dots, and hyphens only
 * @param teamName The team name to validate
 * @returns Object with isValid boolean and error message if invalid
 */
export function validateTeamName(teamName: string): {
  isValid: boolean;
  error?: string;
} {
  if (!teamName || teamName.trim().length === 0) {
    return { isValid: false, error: "Team name is required" };
  }

  const teamNameRegex = /^[\w.-]{4,30}$/;

  if (!teamNameRegex.test(teamName)) {
    return {
      isValid: false,
      error:
        "Team name can only contain letters, numbers, underscores, dots, and hyphens. Must be between 4 and 30 characters.",
    };
  }

  return { isValid: true };
}
