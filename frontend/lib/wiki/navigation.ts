import type { WikiNavItem } from "./types";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getCanonicalSlugForFile, readWikiFrontmatter } from "./documents";
import { contentDirectory } from "./versions";

export async function getWikiNavigationWithVersion(
  version: string,
): Promise<WikiNavItem[]> {
  const versionDirectory = path.join(contentDirectory, version);

  return buildNavigation(versionDirectory, version);
}

async function buildNavigation(
  directory: string,
  version: string,
  basePath: string[] = [],
): Promise<WikiNavItem[]> {
  const items: WikiNavItem[] = [];

  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (
        entry.name.startsWith(".")
        || entry.name === "favicon.ico"
        || entry.name === "index.html"
        || entry.name === "script.js"
        || entry.name === "style.css"
      ) {
        continue;
      }

      const filePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        const children = await buildNavigation(filePath, version, [
          ...basePath,
          entry.name,
        ]);

        if (children.length > 0) {
          items.push({
            title: formatTitle(entry.name),
            slug: [...basePath, entry.name],
            isFile: false,
            children,
          });
        }

        continue;
      }

      if (!entry.name.endsWith(".md")) {
        continue;
      }

      const frontmatter = await readWikiFrontmatter(filePath);
      const fallbackTitle = formatTitle(entry.name.replace(/\.md$/i, ""));
      const title = typeof frontmatter.sidebarTitle === "string"
        ? frontmatter.sidebarTitle
        : typeof frontmatter.title === "string"
          ? frontmatter.title
          : fallbackTitle;

      items.push({
        title,
        slug: getCanonicalSlugForFile(filePath, version, frontmatter),
        isFile: true,
      });
    }
  }
  catch (error) {
    console.error(`Error reading wiki directory ${directory}:`, error);
  }

  return items.sort((left, right) => compareWikiNavItems(left, right, basePath));
}

function compareWikiNavItems(
  left: WikiNavItem,
  right: WikiNavItem,
  basePath: string[],
): number {
  const leftIsReadme = left.isFile && left.slug.join("/") === basePath.join("/");
  const rightIsReadme = right.isFile && right.slug.join("/") === basePath.join("/");

  if (leftIsReadme && !rightIsReadme)
    return -1;
  if (!leftIsReadme && rightIsReadme)
    return 1;

  if (left.isFile && !right.isFile)
    return -1;
  if (!left.isFile && right.isFile)
    return 1;

  return left.title.localeCompare(right.title);
}

function formatTitle(value: string): string {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}
