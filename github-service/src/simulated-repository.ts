/**
 * Matches the repository names the api seed script gives its test teams:
 * "sim-" followed by the team's UUID. Such repositories do not exist on GitHub.
 * Real repository names start with the event name, so they never match.
 */
const SIMULATED_REPOSITORY_NAME =
  /^sim-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether operations on this repository are simulated instead of sent to
 * GitHub. Only ever true when NODE_ENV is "development".
 */
export function isSimulatedRepository(
  repositoryName: string | undefined,
  nodeEnv = process.env.NODE_ENV,
): boolean {
  return (
    nodeEnv === "development" &&
    typeof repositoryName === "string" &&
    SIMULATED_REPOSITORY_NAME.test(repositoryName)
  );
}
