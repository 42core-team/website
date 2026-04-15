import type { WikiDocument, WikiFrontmatter } from "./types";
import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { renderWikiMarkdown } from "./render";
import { contentDirectory } from "./versions";

export async function getWikiDocumentBySlug(
  slug: string[],
  version: string,
): Promise<WikiDocument | null> {
  try {
    const filePath = await resolveWikiFilePath(slug, version);
    if (!filePath) {
      return null;
    }

    return await loadWikiDocument(filePath, version);
  }
  catch (error) {
    console.error(
      `Error reading wiki page ${slug.join("/") || "root"} for version ${version}:`,
      error,
    );
    return null;
  }
}

export async function getAllWikiDocumentsForVersion(
  version: string,
): Promise<WikiDocument[]> {
  const filePaths = await listWikiMarkdownFiles(version);
  const documents = await Promise.all(
    filePaths.map(filePath => getWikiDocumentByFilePath(filePath, version)),
  );

  return documents.filter((document): document is WikiDocument => document !== null);
}

export async function listWikiPageSlugsForVersion(
  version: string,
): Promise<string[][]> {
  const filePaths = await listWikiMarkdownFiles(version);
  const slugs = await Promise.all(
    filePaths.map(async (filePath) => {
      const frontmatter = await readWikiFrontmatter(filePath);
      return getCanonicalSlugForFile(filePath, version, frontmatter);
    }),
  );

  const uniqueSlugs = new Map<string, string[]>();
  for (const slug of slugs) {
    uniqueSlugs.set(slug.join("/"), slug);
  }

  return [...uniqueSlugs.values()];
}

export async function readWikiFrontmatter(
  filePath: string,
): Promise<WikiFrontmatter> {
  try {
    const rawMarkdown = await fs.readFile(filePath, "utf8");
    return matter(rawMarkdown).data as WikiFrontmatter;
  }
  catch {
    return {};
  }
}

export function getCanonicalSlugForFile(
  filePath: string,
  version: string,
  frontmatter: WikiFrontmatter,
): string[] {
  const versionDirectory = path.join(contentDirectory, version);
  const relativePath = path.relative(versionDirectory, filePath)
    .split(path.sep)
    .join(path.posix.sep);
  const fileName = path.posix.basename(relativePath);
  const directory = path.posix.dirname(relativePath);

  if (fileName === "README.md") {
    return directory === "." ? [] : directory.split("/");
  }

  const fileBaseName = fileName.replace(/\.md$/i, "");
  const permalink = typeof frontmatter.permalink === "string"
    ? frontmatter.permalink
    : undefined;
  const slugSegments = directory === "." ? [] : directory.split("/");

  return [...slugSegments, permalink ?? fileBaseName];
}

async function resolveWikiFilePath(
  slug: string[],
  version: string,
): Promise<string | null> {
  const versionDirectory = path.join(contentDirectory, version);
  const decodedSlug = slug.map(segment => decodeURIComponent(segment));

  if (decodedSlug.length === 0) {
    const readmePath = path.join(versionDirectory, "README.md");
    return await fileExists(readmePath) ? readmePath : null;
  }

  const directCandidate = path.resolve(versionDirectory, ...decodedSlug);
  if (!isWithinDirectory(directCandidate, versionDirectory)) {
    throw new Error("Invalid wiki path");
  }

  const directMarkdownPath = `${directCandidate}.md`;
  if (await fileExists(directMarkdownPath)) {
    return directMarkdownPath;
  }

  const readmeCandidate = path.resolve(versionDirectory, ...decodedSlug, "README.md");
  if (!isWithinDirectory(readmeCandidate, versionDirectory)) {
    throw new Error("Invalid wiki path");
  }

  if (await fileExists(readmeCandidate)) {
    return readmeCandidate;
  }

  const parentDirectory = path.resolve(versionDirectory, ...decodedSlug.slice(0, -1));
  if (!isWithinDirectory(parentDirectory, versionDirectory)) {
    throw new Error("Invalid wiki path");
  }

  try {
    const entries = await fs.readdir(parentDirectory, { withFileTypes: true });
    const targetPermalink = decodedSlug[decodedSlug.length - 1];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        continue;
      }

      const filePath = path.join(parentDirectory, entry.name);
      const frontmatter = await readWikiFrontmatter(filePath);
      if (frontmatter.permalink === targetPermalink) {
        return filePath;
      }
    }
  }
  catch {
    return null;
  }

  return null;
}

async function getWikiDocumentByFilePath(
  filePath: string,
  version: string,
): Promise<WikiDocument | null> {
  try {
    return await loadWikiDocument(filePath, version);
  }
  catch (error) {
    console.error(`Error reading wiki file ${filePath}:`, error);
    return null;
  }
}

async function loadWikiDocument(
  filePath: string,
  version: string,
): Promise<WikiDocument> {
  const rawMarkdown = await fs.readFile(filePath, "utf8");
  const parsed = matter(rawMarkdown);
  const frontmatter = parsed.data as WikiFrontmatter;
  const { html, tableOfContents } = await renderWikiMarkdown(parsed.content, {
    filePath,
    version,
  });
  const stats = await fs.stat(filePath);

  return {
    slug: getCanonicalSlugForFile(filePath, version, frontmatter),
    title: getDocumentTitle(filePath, frontmatter, version),
    html,
    frontmatter,
    lastModified: stats.mtime,
    version,
    tableOfContents,
  };
}

async function listWikiMarkdownFiles(version: string): Promise<string[]> {
  const versionDirectory = path.join(contentDirectory, version);
  const files: string[] = [];

  async function walk(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }

      const filePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await walk(filePath);
        continue;
      }

      if (entry.name.endsWith(".md")) {
        files.push(filePath);
      }
    }
  }

  await walk(versionDirectory);
  return files;
}

function getDocumentTitle(
  filePath: string,
  frontmatter: WikiFrontmatter,
  version: string,
): string {
  if (typeof frontmatter.title === "string") {
    return frontmatter.title;
  }

  const slug = getCanonicalSlugForFile(filePath, version, frontmatter);
  if (slug.length === 0) {
    return "README";
  }

  return formatTitle(slug[slug.length - 1] ?? "README");
}

function formatTitle(value: string): string {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  }
  catch {
    return false;
  }
}

function isWithinDirectory(targetPath: string, directory: string): boolean {
  return targetPath.startsWith(path.resolve(directory));
}
