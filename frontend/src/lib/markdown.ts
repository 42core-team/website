import rehypeCodeGroup from "rehype-code-group";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

const FALLBACK_WIKI_VERSION = "latest";

export interface WikiFrontmatter {
  title?: string;
  sidebarTitle?: string;
  permalink?: string;
  [key: string]: unknown;
}

export interface WikiPage {
  slug: string[];
  title: string;
  content: string;
  frontmatter: WikiFrontmatter;
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

const markdownModules = import.meta.glob("../../content/wiki/**/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

interface WikiFile {
  version: string;
  slug: string[];
  path: string;
  raw: string;
  frontmatter: WikiFrontmatter;
}

const wikiFiles = Object.entries(markdownModules).map(([path, raw]) => {
  const parts = path.replace("../../content/wiki/", "").split("/");
  const version = parts[0];
  const fileParts = parts.slice(1);
  const last = fileParts[fileParts.length - 1] ?? "README.md";
  const slug = [
    ...fileParts.slice(0, -1),
    last.replace(/\.md$/, ""),
  ].filter(Boolean);
  const parsed = parseFrontmatter(raw);

  return {
    version,
    slug,
    path,
    raw,
    frontmatter: parsed.data,
  };
});

export async function getDefaultWikiVersion(): Promise<string> {
  const versions = await getAvailableVersions();
  const defaultVersion = versions.find(v => v.isDefault);
  return defaultVersion ? defaultVersion.slug : FALLBACK_WIKI_VERSION;
}

export async function getAvailableVersions(): Promise<WikiVersion[]> {
  const versionSlugs = [...new Set(wikiFiles.map(file => file.version))]
    .filter(slug => slug && slug !== "images" && slug !== "assets");

  const stableSlugs = versionSlugs.filter(slug => isStableTagName(slug));
  const defaultSlug = stableSlugs.length > 0
    ? stableSlugs.sort(compareTagNamesDesc)[0]
    : versionSlugs.includes(FALLBACK_WIKI_VERSION)
      ? FALLBACK_WIKI_VERSION
      : versionSlugs[0];

  return versionSlugs
    .map(slug => ({
      name: formatVersionName(slug),
      slug,
      isDefault: slug === defaultSlug,
    }))
    .sort((a, b) => {
      if (a.isDefault)
        return -1;
      if (b.isDefault)
        return 1;
      return b.name.localeCompare(a.name);
    });
}

export async function getWikiPageWithVersion(
  slug: string[],
  version?: string,
): Promise<WikiPage | null> {
  const actualVersion = version || (await getDefaultWikiVersion());
  const decodedSlug = normalizeSlug(slug);
  const file = findWikiFile(decodedSlug, actualVersion);

  if (!file)
    return null;

  const parsed = parseFrontmatter(file.raw);
  const content = parsed.content;
  const data = parsed.data;

  const processedContent = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypePrettyCode, {
      theme: {
        dark: "github-dark",
        light: "github-light",
      },
    })
    .use(rehypeCodeGroup, {})
    .use(rehypeStringify)
    .process(content);

  let htmlContent = processedContent.toString();

  htmlContent = htmlContent.replace(/<head>[\s\S]*?<\/head>/, "");
  htmlContent = transformCallouts(htmlContent);
  htmlContent = addHeadingAnchors(htmlContent);
  htmlContent = fixWikiLinks(htmlContent, actualVersion);

  const effectiveSlug = [...decodedSlug];
  if (data.permalink && effectiveSlug.length > 0) {
    effectiveSlug[effectiveSlug.length - 1] = data.permalink;
  }

  return {
    slug: effectiveSlug,
    title: data.title ?? getTitleFromSlug(decodedSlug),
    content: htmlContent,
    frontmatter: { ...data },
    lastModified: new Date(0),
    version: actualVersion,
  };
}

export async function getWikiNavigationWithVersion(
  version?: string,
): Promise<WikiNavItem[]> {
  const actualVersion = version || (await getDefaultWikiVersion());
  const files = wikiFiles.filter(file => file.version === actualVersion);

  const root: WikiNavItem[] = [];

  for (const file of files) {
    const slug = getEffectiveSlug(file);
    const dirs = slug.slice(0, -1);
    let level = root;

    for (let i = 0; i < dirs.length; i++) {
      const dirSlug = dirs.slice(0, i + 1);
      let dir = level.find(
        item => !item.isFile && item.slug.join("/") === dirSlug.join("/"),
      );

      if (!dir) {
        dir = {
          title: formatTitle(dirs[i]),
          slug: dirSlug,
          isFile: false,
          children: [],
        };
        level.push(dir);
      }

      level = dir.children ?? [];
    }

    const fileBase = slug[slug.length - 1] ?? "README";
    level.push({
      title:
        typeof file.frontmatter.sidebarTitle === "string"
          ? file.frontmatter.sidebarTitle
          : typeof file.frontmatter.title === "string"
            ? file.frontmatter.title
            : formatTitle(fileBase),
      slug,
      isFile: true,
    });
  }

  const sortItems = (items: WikiNavItem[]): WikiNavItem[] =>
    items
      .map(item => ({
        ...item,
        children: item.children ? sortItems(item.children) : undefined,
      }))
      .sort((a, b) => {
        if (
          a.title.toLowerCase().includes("readme")
          && !b.title.toLowerCase().includes("readme")
        ) {
          return -1;
        }
        if (
          !a.title.toLowerCase().includes("readme")
          && b.title.toLowerCase().includes("readme")
        ) {
          return 1;
        }
        if (a.isFile && !b.isFile)
          return -1;
        if (!a.isFile && b.isFile)
          return 1;
        return a.title.localeCompare(b.title);
      });

  return sortItems(root);
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
      }
      else if (contentMatch) {
        const plainTextContent = stripHtml(page.content);
        const matchIndex = plainTextContent
          .toLowerCase()
          .indexOf(lowercaseQuery);
        matchPosition = matchIndex;

        const start = Math.max(0, matchIndex - 100);
        const end = Math.min(
          plainTextContent.length,
          matchIndex + query.length + 100,
        );
        snippet = plainTextContent.substring(start, end);

        if (start > 0)
          snippet = `...${snippet}`;
        if (end < plainTextContent.length)
          snippet = `${snippet}...`;

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

export async function getAllWikiPagesForVersion(
  version?: string,
): Promise<WikiPage[]> {
  const actualVersion = version || (await getDefaultWikiVersion());
  const pages: WikiPage[] = [];

  for (const file of wikiFiles.filter(file => file.version === actualVersion)) {
    const page = await getWikiPageWithVersion(file.slug, actualVersion);
    if (page) {
      pages.push(page);
    }
  }

  return pages;
}

function findWikiFile(slug: string[], version: string): WikiFile | undefined {
  const files = wikiFiles.filter(file => file.version === version);
  const candidates = getSlugCandidates(slug);

  for (const candidate of candidates) {
    const direct = files.find(file => slugsEqual(file.slug, candidate));
    if (direct)
      return direct;
  }

  const parent = slug.slice(0, -1);
  const last = slug[slug.length - 1];

  return files.find((file) => {
    if (!slugsEqual(file.slug.slice(0, -1), parent))
      return false;
    return file.frontmatter.permalink === last;
  });
}

function getSlugCandidates(slug: string[]): string[][] {
  if (slug.length === 0 || (slug.length === 1 && slug[0] === "")) {
    return [["README"]];
  }

  return [slug, [...slug, "README"]];
}

function normalizeSlug(slug: string[]): string[] {
  return slug
    .filter(segment => segment !== "")
    .map(segment => decodeURIComponent(segment));
}

function slugsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((part, index) => part === b[index]);
}

function getEffectiveSlug(file: WikiFile): string[] {
  const slug = [...file.slug];
  if (file.frontmatter.permalink && slug.length > 0) {
    slug[slug.length - 1] = file.frontmatter.permalink;
  }
  return slug;
}

function transformCallouts(htmlContent: string): string {
  return htmlContent.replace(
    /<blockquote>\s*<p>\s*\[!(WARNING|INFO|NOTE|TIP|IMPORTANT|CAUTION)\]\s*(.*?)<\/p>\s*([\s\S]*?)<\/blockquote>/g,
    (_match: string, type: string, title: string, content: string) => {
      const typeClass = type.toLowerCase();
      const icon = getCalloutIcon(type);
      const titleText = title.trim() || type;

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
}

function addHeadingAnchors(htmlContent: string): string {
  return htmlContent.replace(
    /<h([1-6])>(.*?)<\/h[1-6]>/g,
    (_match: string, level: string, text: string) => {
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .trim();
      return `<h${level} id="${id}"><a href="#${id}" class="heading-anchor">${text}</a></h${level}>`;
    },
  );
}

function fixWikiLinks(htmlContent: string, version: string): string {
  const mdLinksFixed = htmlContent.replace(
    /<a href="([^"]*\.md)"([^>]*)>/g,
    (_match: string, href: string, attributes: string) => {
      const cleanHref = href.replace(/\.md$/, "");
      return `<a href="/wiki/${version}/${cleanHref}"${attributes}>`;
    },
  );

  return mdLinksFixed.replace(
    /<a href="([^"#][^"]*)"([^>]*)>/g,
    (_match: string, href: string, attributes: string) => {
      if (
        href.startsWith("http")
        || href.startsWith("#")
        || href.startsWith("/wiki/")
        || href.startsWith("mailto:")
      ) {
        return _match;
      }

      return `<a href="/wiki/${version}/${href}"${attributes}>`;
    },
  );
}

function formatVersionName(slug: string): string {
  return slug.replace(/[-_]/g, " ");
}

function getTitleFromSlug(slug: string[]): string {
  if (slug.length === 0)
    return "README";
  const lastSegment = decodeURIComponent(slug[slug.length - 1]);
  return formatTitle(lastSegment);
}

function formatTitle(name: string): string {
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

function isStableTagName(name: string): boolean {
  if (name.includes("-"))
    return false;
  const normalized = name.startsWith("v") ? name.slice(1) : name;
  return /^\d+(?:\.\d+)*$/.test(normalized);
}

function parseTagNumbers(name: string): number[] {
  const normalized = name.startsWith("v") ? name.slice(1) : name;
  return normalized.split(".").map(n => Number.parseInt(n, 10) || 0);
}

function compareTagNamesDesc(a: string, b: string): number {
  const aNums = parseTagNumbers(a);
  const bNums = parseTagNumbers(b);
  const maxLen = Math.max(aNums.length, bNums.length);
  for (let i = 0; i < maxLen; i++) {
    const aVal = aNums[i] ?? 0;
    const bVal = bNums[i] ?? 0;
    if (aVal !== bVal)
      return bVal - aVal;
  }
  return 0;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function highlightText(text: string, query: string): string {
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  return text.replace(regex, "<mark>$1</mark>");
}

function parseFrontmatter(raw: string): {
  data: WikiFrontmatter;
  content: string;
} {
  if (!raw.startsWith("---")) {
    return { data: {}, content: raw };
  }

  const end = raw.indexOf("\n---", 3);
  if (end === -1) {
    return { data: {}, content: raw };
  }

  const frontmatter = raw.slice(3, end).trim();
  const contentStart = raw.indexOf("\n", end + 4);
  const content = contentStart === -1 ? "" : raw.slice(contentStart + 1);
  const data: WikiFrontmatter = {};

  for (const line of frontmatter.split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1)
      continue;

    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    if (key) {
      data[key] = value;
    }
  }

  return { data, content };
}

function getCalloutIcon(type: string): string {
  switch (type.toUpperCase()) {
    case "WARNING":
      return "!";
    case "INFO":
      return "i";
    case "NOTE":
      return "N";
    case "TIP":
      return "Tip";
    case "IMPORTANT":
      return "!";
    case "CAUTION":
      return "!";
    default:
      return "i";
  }
}
