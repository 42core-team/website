import type { WikiSearchResult } from "./types";
import { getAllWikiDocumentsForVersion } from "./documents";
import { getDefaultWikiVersion } from "./versions";

export async function searchWikiPages(
  query: string,
  version?: string,
): Promise<WikiSearchResult[]> {
  const activeVersion = version ?? await getDefaultWikiVersion();
  const documents = await getAllWikiDocumentsForVersion(activeVersion);
  const normalizedQuery = query.toLowerCase();
  const results: WikiSearchResult[] = [];

  for (const document of documents) {
    const titleMatch = document.title.toLowerCase().includes(normalizedQuery);
    const plainText = stripHtml(document.html);
    const contentMatch = plainText.toLowerCase().includes(normalizedQuery);

    if (!titleMatch && !contentMatch) {
      continue;
    }

    if (titleMatch) {
      results.push({
        title: document.title,
        slug: document.slug,
        highlightedSnippet: highlightText(document.title, query),
        matchType: "title",
      });
      continue;
    }

    const matchIndex = plainText.toLowerCase().indexOf(normalizedQuery);
    const start = Math.max(0, matchIndex - 100);
    const end = Math.min(
      plainText.length,
      matchIndex + normalizedQuery.length + 100,
    );
    let snippet = plainText.slice(start, end);

    if (start > 0)
      snippet = `...${snippet}`;
    if (end < plainText.length)
      snippet = `${snippet}...`;

    results.push({
      title: document.title,
      slug: document.slug,
      highlightedSnippet: highlightText(snippet, query),
      matchType: "content",
    });
  }

  return results;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function highlightText(value: string, query: string): string {
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(${escapedQuery})`, "gi");
  return value.replace(pattern, "<mark>$1</mark>");
}
