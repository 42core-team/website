/**
 * Repositories whose name starts with this prefix do not exist on GitHub. They
 * let seeded test teams go through the repository lifecycle locally.
 */
export const SIMULATED_REPOSITORY_PREFIX = "sim-";

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
    repositoryName.startsWith(SIMULATED_REPOSITORY_PREFIX)
  );
}
