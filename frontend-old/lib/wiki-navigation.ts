import type { WikiVersion } from "./markdown";

/**
 * Builds the navigation path for switching between wiki versions
 * @param currentPath - The current page pathname
 * @param targetVersion - The version to navigate to
 * @param versions - Available versions to check against
 * @returns The new path for the target version
 */
export function buildVersionPath(
  currentPath: string,
  targetVersion: string,
  versions: WikiVersion[],
): string {
  const pathParts = currentPath.split("/").filter(Boolean);

  if (pathParts[0] !== "wiki") {
    return currentPath; // Not a wiki path, return as-is
  }

  // Remove 'wiki' from the path
  pathParts.shift();

  // Remove current version if it exists
  if (pathParts.length > 0 && versions.some(v => v.slug === pathParts[0])) {
    pathParts.shift();
  }

  // Build new path based on target version
  if (targetVersion === "latest") {
    // For latest, we don't include version in URL
    return pathParts.length > 0 ? `/wiki/${pathParts.join("/")}` : "/wiki";
  }
  else {
    // For specific versions, include version in URL
    return pathParts.length > 0
      ? `/wiki/${targetVersion}/${pathParts.join("/")}`
      : `/wiki/${targetVersion}`;
  }
}
