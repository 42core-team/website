import { promises as fs } from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";

const FALLBACK_WIKI_VERSION = "latest";

export interface WikiPage {
  slug: string[];
  title: string;
  content: string;
  frontmatter: { [key: string]: any };
  lastModified: Date;
  version?: string;
}

export interface WikiSearchResult {
  page: WikiPage;
  snippet: string;
  highlightedSnippet: string;
  matchType: "title" | "content";
  matchPosition?: number;
}

export interface WikiNavItem {
  title: string;
  slug: string[];
  isFile: boolean;
  children?: WikiNavItem[];
}

export interface WikiVersion {
  name: string;
  slug: string;
  isDefault?: boolean;
}

type WikiMetadataHeader = {
	HEADING?: string;
	PERMALINK?: string;
	SIDEBAR_HEADING?: string;
};

function parseWikiMetadataHeader(raw: string): { header: WikiMetadataHeader | null; body: string } {
  const lines = raw.split(/\r?\n/);
  if (!lines[0] || lines[0].trim() !== "=====") return { header: null, body: raw };

  let end = -1;
  for (let i = 1; i < Math.min(lines.length, 200); i++) {
    if (lines[i].trim() === "=====") {
      end = i;
      break;
    }
  }
  if (end === -1) return { header: null, body: raw };

  const headerLines = lines.slice(1, end);
  const header: WikiMetadataHeader = {};
  for (const line of headerLines) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"([^"]*)"\s*$/);
    if (m) {
      const k = m[1] as keyof WikiMetadataHeader;
      header[k] = m[2];
    }
  }

  const body = lines.slice(end + 1).join("\n").replace(/^\s+/, "");
  return { header, body };
}

const contentDirectory = path.join(process.cwd(), "content/wiki");

// Exposed default wiki version getter for centralized control
export async function getDefaultWikiVersion(): Promise<string> {
  const versions = await getAvailableVersions();
  const defaultVersion = versions.find((v) => v.isDefault);
  return defaultVersion ? defaultVersion.slug : FALLBACK_WIKI_VERSION;
}

export async function getAvailableVersions(): Promise<WikiVersion[]> {
  try {
    const entries = await fs.readdir(contentDirectory, { withFileTypes: true });
    const versions: WikiVersion[] = [];

    // Add directories as versions (no more root-level files handling)
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        entry.name !== "images" &&
        entry.name !== "assets"
      ) {
        versions.push({
          name: formatVersionName(entry.name),
          slug: entry.name,
          isDefault: false, // assign below based on newest tag
        });
      }
    }

    // Determine newest stable tag as default, if any exist
    const tagSlugs = versions
      .map((v) => v.slug)
      .filter((slug) => isStableTagName(slug));

    let defaultSlug = FALLBACK_WIKI_VERSION;
    if (tagSlugs.length > 0) {
      defaultSlug = tagSlugs.sort(compareTagNamesDesc)[0];
    }

    versions.forEach((v) => {
      v.isDefault = v.slug === defaultSlug;
    });

    return versions.sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return b.name.localeCompare(a.name);
    });
  } catch (error) {
    console.error("Error reading versions:", error);
    return [];
  }
}

export async function getWikiPageWithVersion(
  slug: string[],
  version?: string,
): Promise<WikiPage | null> {
  try {
    const filePath = await getFilePathFromSlugWithVersion(slug, version);
    let fileContent: string;
    try {
      fileContent = await fs.readFile(filePath, "utf8");
    } catch (err: any) {
      if (err.code === "ENOENT") {
        // If the file truly does not exist, signal not found so nice error message appears
        return null;
      } else {
        throw err;
      }
    }

	const { header, body } = parseWikiMetadataHeader(fileContent);

    const { data, content } = matter(body);

    // Process markdown content with callout support
    const processedContent = await remark()
      .use(remarkGfm)
      .use(remarkHtml, { sanitize: false })
      .process(content);

    // Post-process the HTML to add IDs to headings and handle callouts
    let htmlContent = processedContent.toString();

    // Transform GitHub-style callouts (> [!TYPE])
    htmlContent = htmlContent.replace(
      /<blockquote>\s*<p>\s*\[!(WARNING|INFO|NOTE|TIP|IMPORTANT|CAUTION)\]\s*(.*?)<\/p>\s*([\s\S]*?)<\/blockquote>/g,
      (_match: string, type: string, title: string, content: string) => {
        const typeClass = type.toLowerCase();
        const icon = getCalloutIcon(type);
        const titleText = title.trim() || type;

        // Clean up content and remove any extra paragraph tags if present
        let cleanContent = content.trim();
        if (cleanContent.startsWith("<p>") && cleanContent.endsWith("</p>")) {
          cleanContent = cleanContent.slice(3, -4);
        }

        return `<div class="callout callout-${typeClass}">
          <div class="callout-header">
            <span class="callout-icon">${icon}</span>
            <span class="callout-title">${titleText}</span>
          </div>
          <div class="callout-content">${cleanContent}</div>
        </div>`;
      },
    );

    // Transform image paths to use the API route
    const imageVersion = version || (await getDefaultWikiVersion());
    htmlContent = htmlContent.replace(
      /<img([^>]*)\ssrc="([^"]+)"([^>]*)>/g,
      (_match: string, beforeSrc: string, src: string, afterSrc: string) => {
        // Skip if already an absolute URL or API path
        if (src.startsWith("http") || src.startsWith("/api/wiki-images/")) {
          return _match;
        }

        // For relative image paths, determine the correct directory
        let imagePath: string;

        if (path.basename(filePath) === "README.md") {
          // For README files, images are relative to the directory containing the README
          const readmeDir = path.dirname(
            path.relative(path.join(contentDirectory, imageVersion), filePath),
          );
          imagePath = readmeDir
            ? path.posix.join(imageVersion, readmeDir, src)
            : path.posix.join(imageVersion, src);
        } else {
          // For regular .md files, images are relative to the file's directory
          const fileDir = path.dirname(
            path.relative(path.join(contentDirectory, imageVersion), filePath),
          );
          imagePath = fileDir
            ? path.posix.join(imageVersion, fileDir, src)
            : path.posix.join(imageVersion, src);
        }

        const apiPath = `/api/wiki-images/${imagePath}`;
        return `<img${beforeSrc} src="${apiPath}"${afterSrc}>`;
      },
    );

    // Simple regex to add IDs to headings
    htmlContent = htmlContent.replace(
      /<h([1-6])>(.*?)<\/h[1-6]>/g,
      (_match: string, level: string, text: string) => {
        const id = text
          .toLowerCase()
          .replace(/[^\w\s-]/g, "") // Remove special characters
          .replace(/\s+/g, "-") // Replace spaces with hyphens
          .trim();
        return `<h${level} id="${id}"><a href="#${id}" class="heading-anchor">${text}</a></h${level}>`;
      },
    );

    // Fix .md links to work with wiki routing
    const actualVersion = version || (await getDefaultWikiVersion());
    htmlContent = htmlContent.replace(
      /<a href="([^"]*\.md)"([^>]*)>/g,
      (_match: string, href: string, attributes: string) => {
        // Remove .md extension and create proper wiki URL
        const cleanHref = href.replace(/\.md$/, "");
        const wikiUrl = `/wiki/${actualVersion}/${cleanHref}`;
        return `<a href="${wikiUrl}"${attributes}>`;
      },
    );

    // Fix relative links that don't end with .md but should be wiki links
    htmlContent = htmlContent.replace(
      /<a href="([^"#][^"]*)"([^>]*)>/g,
      (_match: string, href: string, attributes: string) => {
        // Skip if it's already a full URL, fragment link, or wiki link
        if (
          href.startsWith("http") ||
          href.startsWith("#") ||
          href.startsWith("/wiki/")
        ) {
          return _match;
        }
        // Convert relative links to wiki URLs
        const wikiUrl = `/wiki/${actualVersion}/${href}`;
        return `<a href="${wikiUrl}"${attributes}>`;
      },
    );

    let lastModified: Date;
    try {
      const stats = await fs.stat(filePath);
      lastModified = stats.mtime;
    } catch (err: any) {
      if (err.code === "ENOENT") {
        lastModified = new Date(0); // fallback for missing file
      } else {
        throw err;
      }
    }

    // Respect custom HEADING for page title; fall back gracefully
	const pageTitle =
		(header && ("HEADING" in header) ? header.HEADING as string : undefined) ??
		(typeof data.title === "string" ? data.title : undefined) ??
		getTitleFromSlug(slug);

    // If PERMALINK is set, the public slug must reflect it (last segment)
	const effectiveSlug = [...slug];
	if (header && ("PERMALINK" in header) && effectiveSlug.length > 0) {
	effectiveSlug[effectiveSlug.length - 1] = header.PERMALINK as string;
	}

    return {
      slug: effectiveSlug,
      title: pageTitle,
      content: htmlContent,
      frontmatter: { ...data, __coreHeader: header ?? undefined },
      lastModified,
      version,
    };
  } catch (error) {
    console.error(
      `Error reading wiki page ${slug?.join("/") || "unknown"} for version ${version}:`,
      error,
    );
    return null;
  }
}

export async function getWikiNavigationWithVersion(
  version?: string,
): Promise<WikiNavItem[]> {
  // Get the default version if none specified
  const actualVersion = version || (await getDefaultWikiVersion());
  const versionDir = path.join(contentDirectory, actualVersion);

  const buildNavigation = async (
    dir: string,
    basePath: string[] = [],
  ): Promise<WikiNavItem[]> => {
    const items: WikiNavItem[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (
          entry.name.startsWith(".") ||
          entry.name === "index.html" ||
          entry.name === "script.js" ||
          entry.name === "style.css" ||
          entry.name === "favicon.ico"
        ) {
          continue;
        }

        if (entry.isDirectory()) {
          const children = await buildNavigation(path.join(dir, entry.name), [
            ...basePath,
            entry.name,
          ]);
          // Only include directories that have markdown files (either directly or in subdirectories)
          if (children.length > 0) {
            items.push({
              title: formatTitle(entry.name),
              slug: [...basePath, entry.name],
              isFile: false,
              children: children,
            });
          }
} else if (entry.name.endsWith(".md")) {
  const fsPath = path.join(dir, entry.name);

  let sidebarTitleOverride: string | undefined;
  let permalinkOverride: string | undefined;

  try {
    const raw = await fs.readFile(fsPath, "utf8");
    const { header } = parseWikiMetadataHeader(raw);
    if (header) {
      if ("SIDEBAR_HEADING" in header) sidebarTitleOverride = header.SIDEBAR_HEADING as string;
      else if ("HEADING" in header) sidebarTitleOverride = header.HEADING as string;

      if ("PERMALINK" in header) permalinkOverride = header.PERMALINK as string;
    }
  } catch {
    // ignore file read errors, navigation will still render
  }

  const fileBase = entry.name.replace(".md", "");
  const finalLastSegment = (permalinkOverride !== undefined) ? permalinkOverride : fileBase;

  const slug = [...basePath, finalLastSegment];
  items.push({
    title: (sidebarTitleOverride !== undefined) ? sidebarTitleOverride : formatTitle(fileBase),
    slug,
    isFile: true,
  });
}

      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
    }

    return items.sort((a, b) => {
      // Put README files first
      if (
        a.title.toLowerCase().includes("readme") &&
        !b.title.toLowerCase().includes("readme")
      )
        return -1;
      if (
        !a.title.toLowerCase().includes("readme") &&
        b.title.toLowerCase().includes("readme")
      )
        return 1;

      // Put files before directories
      if (a.isFile && !b.isFile) return -1;
      if (!a.isFile && b.isFile) return 1;

      return a.title.localeCompare(b.title);
    });
  };

  return buildNavigation(versionDir);
}

async function getFilePathFromSlugWithVersion(
  slug: string[],
  version?: string,
): Promise<string> {
  const actualVersion = version || (await getDefaultWikiVersion());
  const versionDir = path.join(contentDirectory, actualVersion);

  const decodedSlug = slug.map((segment) => decodeURIComponent(segment));

  if (decodedSlug.length === 0 || (decodedSlug.length === 1 && decodedSlug[0] === "")) {
    return path.join(versionDir, "README.md");
  }

  const candidateDirect = path.resolve(versionDir, ...decodedSlug) + ".md";
  if (!candidateDirect.startsWith(path.resolve(versionDir))) {
    throw new Error("Invalid wiki path");
  }

  try {
    await fs.access(candidateDirect);
    return candidateDirect;
  } catch {
    // Try README in directory
    const candidateReadme = path.resolve(versionDir, ...decodedSlug, "README.md");
    if (!candidateReadme.startsWith(path.resolve(versionDir))) {
      throw new Error("Invalid wiki path");
    }
    try {
      await fs.access(candidateReadme);
      return candidateReadme;
    } catch {
      // FALLBACK: last segment might be a PERMALINK pointing to some file in this directory
      const parentDir = path.resolve(versionDir, ...decodedSlug.slice(0, -1));
      if (!parentDir.startsWith(path.resolve(versionDir))) {
        throw new Error("Invalid wiki path");
      }
      try {
        const entries = await fs.readdir(parentDir, { withFileTypes: true });
        for (const e of entries) {
          if (!e.isFile() || !e.name.endsWith(".md")) continue;
          const p = path.join(parentDir, e.name);
          try {
            const raw = await fs.readFile(p, "utf8");
            const { header } = parseWikiMetadataHeader(raw);
            if (header?.PERMALINK && header.PERMALINK === decodedSlug[decodedSlug.length - 1]) {
              return p;
            }
          } catch {
            // ignore a single file read error and continue
          }
        }
      } catch {
        // parent directory not readable or doesn't exist
      }
    }
  }

  // Default to README inside the target path if everything above failed
  return path.resolve(versionDir, ...decodedSlug, "README.md");
}

function formatVersionName(slug: string): string {
  // Convert kebab-case or snake_case to Title Case
  return slug.replace(/[-_]/g, " ");
}

function getTitleFromSlug(slug: string[]): string {
  if (slug.length === 0) return "README";
  // Decode the last segment to handle URL-encoded characters
  const lastSegment = decodeURIComponent(slug[slug.length - 1]);
  return formatTitle(lastSegment);
}

function formatTitle(name: string): string {
  // Convert kebab-case or snake_case to Title Case
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

// Helpers to detect and compare stable tag directory names like "v1.2.3" or "1.2.3.4"
function isStableTagName(name: string): boolean {
  if (name.includes("-")) return false; // exclude pre-release markers
  const normalized = name.startsWith("v") ? name.slice(1) : name;
  return /^\d+(?:\.\d+)*$/.test(normalized);
}

function parseTagNumbers(name: string): number[] {
  const normalized = name.startsWith("v") ? name.slice(1) : name;
  return normalized.split(".").map((n) => parseInt(n, 10) || 0);
}

function compareTagNamesDesc(a: string, b: string): number {
  const aNums = parseTagNumbers(a);
  const bNums = parseTagNumbers(b);
  const maxLen = Math.max(aNums.length, bNums.length);
  for (let i = 0; i < maxLen; i++) {
    const aVal = aNums[i] ?? 0;
    const bVal = bNums[i] ?? 0;
    if (aVal !== bVal) return bVal - aVal; // descending: larger first
  }
  return 0;
}

export async function searchWikiPages(
  query: string,
  version?: string,
): Promise<WikiSearchResult[]> {
  const allPages = await getAllWikiPagesForVersion(version);
  const lowercaseQuery = query.toLowerCase();
  const results: WikiSearchResult[] = [];

  for (const page of allPages) {
    const titleMatch = page.title.toLowerCase().includes(lowercaseQuery);
    const contentMatch = page.content.toLowerCase().includes(lowercaseQuery);

    if (titleMatch || contentMatch) {
      let snippet = "";
      let highlightedSnippet = "";
      let matchType: "title" | "content" = "title";
      let matchPosition: number | undefined;

      if (titleMatch) {
        snippet = page.title;
        highlightedSnippet = highlightText(page.title, query);
        matchType = "title";
      } else if (contentMatch) {
        const plainTextContent = stripHtml(page.content);
        const matchIndex = plainTextContent
          .toLowerCase()
          .indexOf(lowercaseQuery);
        matchPosition = matchIndex;

        // Extract snippet around the match (100 chars before and after)
        const start = Math.max(0, matchIndex - 100);
        const end = Math.min(
          plainTextContent.length,
          matchIndex + query.length + 100,
        );
        snippet = plainTextContent.substring(start, end);

        // Add ellipsis if we're not at the beginning/end
        if (start > 0) snippet = "..." + snippet;
        if (end < plainTextContent.length) snippet = snippet + "...";

        highlightedSnippet = highlightText(snippet, query);
        matchType = "content";
      }

      results.push({
        page,
        snippet,
        highlightedSnippet,
        matchType,
        matchPosition,
      });
    }
  }

  return results;
}

// Helper function to strip HTML tags
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Helper function to highlight search terms
function highlightText(text: string, query: string): string {
  const regex = new RegExp(`(${query})`, "gi");
  return text.replace(regex, "<mark>$1</mark>");
}

export async function getAllWikiPagesForVersion(
  version?: string,
): Promise<WikiPage[]> {
  const pages: WikiPage[] = [];
  // Get the default version if none specified
  const actualVersion = version || (await getDefaultWikiVersion());
  const versionDir = path.join(contentDirectory, actualVersion);

  async function walkDirectory(
    dir: string,
    basePath: string[] = [],
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          await walkDirectory(path.join(dir, entry.name), [
            ...basePath,
            entry.name,
          ]);
        } else if (entry.name.endsWith(".md")) {
          const slug = [...basePath, entry.name.replace(".md", "")];
          const page = await getWikiPageWithVersion(slug, actualVersion);
          if (page) {
            pages.push(page);
          }
        }
      }
    } catch (error) {
      console.error(`Error walking directory ${dir}:`, error);
    }
  }

  await walkDirectory(versionDir);
  return pages;
}

function getCalloutIcon(type: string): string {
  switch (type.toUpperCase()) {
    case "WARNING":
      return "⚠️";
    case "INFO":
      return "ℹ️";
    case "NOTE":
      return "📝";
    case "TIP":
      return "💡";
    case "IMPORTANT":
      return "❗";
    case "CAUTION":
      return "🚨";
    default:
      return "ℹ️";
  }
}
