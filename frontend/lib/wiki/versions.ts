import type { WikiVersion, WikiVersionKind } from "./types";
import { promises as fs } from "node:fs";
import path from "node:path";

export const contentDirectory = path.join(process.cwd(), "content/wiki");

const CHANNEL_VERSION_SLUGS = new Set(["dev", "test"]);
const IGNORED_VERSION_DIRECTORIES = new Set(["assets", "images"]);

export async function getAvailableVersions(): Promise<WikiVersion[]> {
  try {
    const entries = await fs.readdir(contentDirectory, {
      withFileTypes: true,
    });

    const rawVersions = entries
      .filter(entry =>
        entry.isDirectory()
        && !entry.name.startsWith(".")
        && !IGNORED_VERSION_DIRECTORIES.has(entry.name),
      )
      .map((entry) => {
        const slug = entry.name;
        return {
          name: formatVersionName(slug),
          slug,
          isDefault: false,
          kind: getWikiVersionKind(slug),
        } satisfies WikiVersion;
      });

    if (rawVersions.length === 0) {
      return [];
    }

    const defaultVersion = pickDefaultVersion(rawVersions.map(version => version.slug));
    const versions = rawVersions.map(version => ({
      ...version,
      isDefault: version.slug === defaultVersion,
    }));

    return sortWikiVersions(versions);
  }
  catch (error) {
    console.error("Error reading wiki versions:", error);
    return [];
  }
}

export async function getDefaultWikiVersion(): Promise<string> {
  const versions = await getAvailableVersions();
  return getDefaultWikiVersionFromVersions(versions);
}

export function sortWikiVersions(versions: WikiVersion[]): WikiVersion[] {
  return [...versions].sort((left, right) => {
    if (left.isDefault)
      return -1;
    if (right.isDefault)
      return 1;

    if (left.kind === "stable" && right.kind === "stable") {
      return compareTagNamesDesc(left.slug, right.slug);
    }

    if (left.kind === "stable")
      return -1;
    if (right.kind === "stable")
      return 1;

    return left.slug.localeCompare(right.slug);
  });
}

export function isKnownWikiVersion(
  versions: WikiVersion[],
  slug: string,
): boolean {
  return versions.some(version => version.slug === slug);
}

export function isStableTagName(name: string): boolean {
  if (name.includes("-"))
    return false;

  const normalized = name.startsWith("v") ? name.slice(1) : name;
  return /^\d+(?:\.\d+)*$/.test(normalized);
}

export function getDefaultWikiVersionFromVersions(
  versions: Pick<WikiVersion, "slug" | "isDefault">[],
): string {
  const defaultVersion = versions.find(version => version.isDefault);

  if (!defaultVersion) {
    throw new Error("No wiki versions available");
  }

  return defaultVersion.slug;
}

function pickDefaultVersion(versionSlugs: string[]): string {
  const stableVersions = versionSlugs
    .filter(isStableTagName)
    .sort(compareTagNamesDesc);

  if (stableVersions.length > 0) {
    return stableVersions[0];
  }

  if (versionSlugs.includes("dev")) {
    return "dev";
  }

  return [...versionSlugs].sort((left, right) => left.localeCompare(right))[0];
}

function formatVersionName(slug: string): string {
  return slug.replace(/[-_]/g, " ");
}

function getWikiVersionKind(slug: string): WikiVersionKind {
  if (isStableTagName(slug)) {
    return "stable";
  }

  if (CHANNEL_VERSION_SLUGS.has(slug)) {
    return "channel";
  }

  return "legacy";
}

function compareTagNamesDesc(left: string, right: string): number {
  const leftNumbers = parseTagNumbers(left);
  const rightNumbers = parseTagNumbers(right);
  const maxLength = Math.max(leftNumbers.length, rightNumbers.length);

  for (let index = 0; index < maxLength; index++) {
    const leftValue = leftNumbers[index] ?? 0;
    const rightValue = rightNumbers[index] ?? 0;

    if (leftValue !== rightValue) {
      return rightValue - leftValue;
    }
  }

  return 0;
}

function parseTagNumbers(name: string): number[] {
  const normalized = name.startsWith("v") ? name.slice(1) : name;
  return normalized.split(".").map(part => Number.parseInt(part, 10) || 0);
}
