import type { WikiTocItem } from "./types";
import path from "node:path";
import rehypeCodeGroup from "rehype-code-group";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { buildWikiPath } from "./shared-paths";
import { contentDirectory } from "./versions";

interface RenderWikiMarkdownOptions {
  filePath: string;
  version: string;
}

export interface RenderedWikiMarkdown {
  html: string;
  tableOfContents: WikiTocItem[];
}

export async function renderWikiMarkdown(
  markdown: string,
  options: RenderWikiMarkdownOptions,
): Promise<RenderedWikiMarkdown> {
  const processed = await unified()
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
    .process(markdown);

  let html = processed.toString();

  html = stripInjectedHead(html);
  html = transformCallouts(html);
  html = rewriteRelativeImages(html, options);
  html = injectHeadingAnchors(html);
  html = rewriteWikiLinks(html, options);

  return {
    html,
    tableOfContents: extractTableOfContents(html),
  };
}

function stripInjectedHead(html: string): string {
  return html.replace(/<head>[\s\S]*?<\/head>/, "");
}

function transformCallouts(html: string): string {
  return html.replace(
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    /<blockquote>\s*<p>\s*\[!(WARNING|INFO|NOTE|TIP|IMPORTANT|CAUTION)\]\s*(.*?)<\/p>\s*([\s\S]*?)<\/blockquote>/g,
    (_match: string, type: string, title: string, content: string) => {
      const cleanContent = unwrapSingleParagraph(content.trim());
      const normalizedType = type.toLowerCase();
      const titleText = title.trim() || type;

      return `<div class="callout callout-${normalizedType}">
        <div class="callout-header">
          <span class="callout-icon">${getCalloutIcon(type)}</span>
          <span class="callout-title">${titleText}</span>
        </div>
        <div class="callout-content">${cleanContent}</div>
      </div>`;
    },
  );
}

function rewriteRelativeImages(
  html: string,
  options: RenderWikiMarkdownOptions,
): string {
  return html.replace(
    /<img([^>]*)\ssrc="([^"]+)"([^>]*)>/g,
    (match: string, beforeSrc: string, src: string, afterSrc: string) => {
      if (
        src.startsWith("http")
        || src.startsWith("/api/wiki-images/")
        || src.startsWith("/")
      ) {
        return match;
      }

      const imagePath = resolveFileRelativePath(src, options);
      return `<img${beforeSrc} src="/api/wiki-images/${imagePath}"${afterSrc}>`;
    },
  );
}

function injectHeadingAnchors(html: string): string {
  const seenIds = new Map<string, number>();

  return html.replace(
    /<h([1-6])>([\s\S]*?)<\/h\1>/g,
    (_match: string, level: string, content: string) => {
      const baseId = slugifyHeading(stripHtml(content));
      const seenCount = seenIds.get(baseId) ?? 0;
      const id = seenCount === 0 ? baseId : `${baseId}-${seenCount + 1}`;
      seenIds.set(baseId, seenCount + 1);

      return `<h${level} id="${id}"><a href="#${id}" class="heading-anchor">${content}</a></h${level}>`;
    },
  );
}

function rewriteWikiLinks(
  html: string,
  options: RenderWikiMarkdownOptions,
): string {
  return html.replace(
    /<a href="([^"]+)"([^>]*)>/g,
    (match: string, href: string, attributes: string) => {
      if (
        href.startsWith("#")
        || href.startsWith("http")
        || href.startsWith("mailto:")
        || href.startsWith("tel:")
        || href.startsWith("/wiki/")
        || href.startsWith("/api/")
        || href.startsWith("/")
      ) {
        return match;
      }

      const [pathPart, hash] = href.split("#");
      const targetPath = resolveWikiLinkPath(pathPart, options);
      const targetHref = hash
        ? `${buildWikiPath(options.version, targetPath)}#${hash}`
        : buildWikiPath(options.version, targetPath);

      return `<a href="${targetHref}"${attributes}>`;
    },
  );
}

function extractTableOfContents(html: string): WikiTocItem[] {
  const items: WikiTocItem[] = [];
  const headingPattern
    = /<h([1-6]) id="([^"]+)"><a href="#[^"]+" class="heading-anchor">([\s\S]*?)<\/a><\/h\1>/g;

  for (const match of html.matchAll(headingPattern)) {
    const [, level, id, content] = match;
    const text = stripHtml(content).trim();

    if (!text) {
      continue;
    }

    items.push({
      id,
      level: Number.parseInt(level, 10),
      text,
    });
  }

  return items;
}

function resolveWikiLinkPath(
  href: string,
  options: RenderWikiMarkdownOptions,
): string[] {
  const cleanHref = href.replace(/\.md$/i, "").trim();
  if (!cleanHref) {
    return getRouteDirectorySegments(options.filePath, options.version);
  }

  if (cleanHref.startsWith("./") || cleanHref.startsWith("../")) {
    const currentDirectory = getRouteDirectorySegments(options.filePath, options.version).join("/");
    const resolvedPath = normalizePosixPath(
      path.posix.join(currentDirectory, cleanHref),
    );
    return resolvedPath.length > 0 ? resolvedPath.split("/") : [];
  }

  const resolvedPath = normalizePosixPath(cleanHref);
  return resolvedPath.length > 0 ? resolvedPath.split("/") : [];
}

function resolveFileRelativePath(
  src: string,
  options: RenderWikiMarkdownOptions,
): string {
  const versionDirectory = path.join(contentDirectory, options.version);
  const fileDirectory = path.dirname(options.filePath);
  const relativeDirectory = path.relative(versionDirectory, fileDirectory)
    .split(path.sep)
    .join(path.posix.sep);

  return normalizePosixPath(
    path.posix.join(options.version, relativeDirectory, src),
  );
}

function getRouteDirectorySegments(filePath: string, version: string): string[] {
  const versionDirectory = path.join(contentDirectory, version);
  const relativeFilePath = path.relative(versionDirectory, filePath)
    .split(path.sep)
    .join(path.posix.sep);
  const directory = path.posix.dirname(relativeFilePath);

  return directory === "." ? [] : directory.split("/");
}

function normalizePosixPath(value: string): string {
  const normalized = path.posix.normalize(value).replace(/^\/+/, "");
  return normalized === "." ? "" : normalized;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function unwrapSingleParagraph(value: string): string {
  if (value.startsWith("<p>") && value.endsWith("</p>")) {
    return value.slice(3, -4);
  }

  return value;
}

function slugifyHeading(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .trim();

  return slug.length > 0 ? slug : "section";
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
