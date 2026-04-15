import type { WikiVersion } from "./types";

export function buildWikiPath(version: string, pagePath: string[] = []): string {
  const encodedSegments = pagePath.map(segment => encodeURIComponent(segment));
  return encodedSegments.length > 0
    ? `/wiki/${version}/${encodedSegments.join("/")}`
    : `/wiki/${version}`;
}

export function buildVersionPath(
  currentPath: string,
  targetVersion: string,
  versions: WikiVersion[],
): string {
  const pathParts = currentPath.split("/").filter(Boolean);
  if (pathParts[0] !== "wiki") {
    return currentPath;
  }

  const wikiSegments = pathParts.slice(1);
  const currentVersionSegment = wikiSegments[0];

  if (
    currentVersionSegment === "latest"
    || versions.some(version => version.slug === currentVersionSegment)
  ) {
    wikiSegments.shift();
  }

  return buildWikiPath(targetVersion, wikiSegments);
}

export function stripReadmeSegment(pagePath: string[]): string[] {
  const lastSegment = pagePath[pagePath.length - 1];

  if (!lastSegment || lastSegment.toLowerCase() !== "readme") {
    return pagePath;
  }

  return pagePath.slice(0, -1);
}
