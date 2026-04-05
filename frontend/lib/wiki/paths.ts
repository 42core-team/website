import { buildWikiPath, stripReadmeSegment } from "./shared-paths";
import {
  getAvailableVersions,
  getDefaultWikiVersionFromVersions,
  isKnownWikiVersion,
} from "./versions";

export interface ParsedWikiRoute {
  requestedVersion: string;
  version: string;
  pagePath: string[];
  redirectPath?: string;
}

export async function parseWikiRouteSlug(
  slug: string[],
): Promise<ParsedWikiRoute | null> {
  const versions = await getAvailableVersions();
  if (versions.length === 0) {
    return null;
  }

  const normalizedSlug = slug.filter(Boolean).map(segment => decodeURIComponent(segment));
  const defaultVersion = getDefaultWikiVersionFromVersions(versions);

  if (normalizedSlug.length === 0) {
    return {
      requestedVersion: defaultVersion,
      version: defaultVersion,
      pagePath: [],
      redirectPath: buildWikiPath(defaultVersion, []),
    };
  }

  const [requestedVersion, ...requestedPagePath] = normalizedSlug;

  if (requestedVersion === "latest") {
    const pagePath = normalizeWikiPagePath(requestedPagePath);
    return {
      requestedVersion,
      version: defaultVersion,
      pagePath,
      redirectPath: buildWikiPath(defaultVersion, pagePath),
    };
  }

  if (!isKnownWikiVersion(versions, requestedVersion)) {
    return null;
  }

  const pagePath = normalizeWikiPagePath(requestedPagePath);
  const canonicalPagePath = stripReadmeSegment(pagePath);

  return {
    requestedVersion,
    version: requestedVersion,
    pagePath: canonicalPagePath,
    redirectPath:
      pagePath.length !== canonicalPagePath.length
        ? buildWikiPath(requestedVersion, canonicalPagePath)
        : undefined,
  };
}

function normalizeWikiPagePath(pagePath: string[]): string[] {
  return pagePath.filter(Boolean).map(segment => decodeURIComponent(segment));
}
