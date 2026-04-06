"use client";

import type { WikiSearchResult } from "@/lib/wiki/types";
import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  getWikiScrollContainer,
  scrollWikiElementIntoView,
} from "@/lib/wiki-scroll";
import styles from "./WikiSearch.module.css";

interface WikiSearchProps {
  onResults?: (results: WikiSearchResult[]) => void;
  currentVersion: string;
}

export function WikiSearch({
  onResults,
  currentVersion,
}: WikiSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WikiSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);
  const router = useRouter();

  useEffect(() => {
    let aborted = false;

    const runSearch = async () => {
      const activeQuery = debouncedQuery.trim();
      if (!activeQuery) {
        setResults([]);
        onResults?.([]);
        return;
      }

      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/wiki/search?q=${encodeURIComponent(activeQuery)}&version=${encodeURIComponent(currentVersion)}`,
        );

        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`);
        }

        const searchResults = await response.json() as WikiSearchResult[];
        if (!aborted) {
          setResults(searchResults);
          onResults?.(searchResults);
        }
      }
      catch (error) {
        if (!aborted) {
          console.error("Search error:", error);
          setResults([]);
          onResults?.([]);
        }
      }
      finally {
        if (!aborted) {
          setIsLoading(false);
        }
      }
    };

    runSearch();

    return () => {
      aborted = true;
    };
  }, [currentVersion, debouncedQuery, onResults]);

  const handleResultClick = useCallback((result: WikiSearchResult) => {
    const href = `/wiki/${currentVersion}/${result.slug.join("/")}`;
    const searchSnapshot = query.trim().toLowerCase();

    setQuery("");
    router.push(href, { scroll: false });

    if (result.matchType !== "content" || !searchSnapshot) {
      return;
    }

    requestAnimationFrame(() => {
      setTimeout(() => {
        const contentContainer = getWikiScrollContainer();
        if (!contentContainer)
          return;

        const elements = contentContainer.querySelectorAll(
          "p, h1, h2, h3, h4, h5, h6, li, td, th",
        );

        for (const element of Array.from(elements)) {
          if (!element.textContent?.toLowerCase().includes(searchSnapshot)) {
            continue;
          }

          scrollWikiElementIntoView(element as HTMLElement, {
            block: "center",
          });
          element.classList.add(styles.wikiHighlightTemp);

          setTimeout(() => {
            element.classList.remove(styles.wikiHighlightTemp);
          }, 2000);
          break;
        }
      }, 600);
    });
  }, [currentVersion, query, router]);

  return (
    <div className="relative" aria-label="Wiki search component">
      <InputGroup className="border-border/80 bg-background/80 shadow-sm backdrop-blur">
        <InputGroupAddon className="pl-4 text-muted-foreground">
          <Search className="size-4" />
        </InputGroupAddon>
        <InputGroupInput
          type="text"
          aria-label="Search documentation"
          placeholder="Search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          className="h-11 text-sm"
        />
      </InputGroup>

      {query && (
        <div
          data-wiki-search-results="true"
          className="absolute top-full right-0 left-0 z-30 mt-3 max-h-96 overflow-y-auto rounded-md border border-border/80 bg-background/95 p-2 shadow-[0_25px_70px_-45px_rgba(15,23,42,0.55)] backdrop-blur"
          role="listbox"
          aria-label="Search results"
        >
          {isLoading
            ? (
                <div className="px-4 py-5 text-center text-sm text-muted-foreground">
                  Searching…
                </div>
              )
            : results.length > 0
              ? (
                  <div className="space-y-1">
                    {results.map((result) => {
                      const href = `/wiki/${currentVersion}/${result.slug.join("/")}`;

                      return (
                        <Link
                          prefetch={false}
                          key={result.slug.join("/")}
                          href={href}
                          onClick={(event) => {
                            event.preventDefault();
                            handleResultClick(result);
                          }}
                          className="block rounded-md px-4 py-3 transition-colors hover:bg-muted/70 focus:bg-muted focus:outline-none"
                          role="option"
                          aria-selected={false}
                        >
                          <div className="text-sm font-medium text-foreground">
                            {result.title}
                          </div>
                          <div
                            className="mt-1 line-clamp-2 text-xs text-muted-foreground"
                            dangerouslySetInnerHTML={{
                              __html: result.highlightedSnippet,
                            }}
                          />
                          <div className="mt-2 text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                            {result.matchType === "title"
                              ? "Title match"
                              : "Content match"}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )
              : (
                  <div className="px-4 py-5 text-center text-sm text-muted-foreground">
                    No results found
                  </div>
                )}
        </div>
      )}
    </div>
  );
}
