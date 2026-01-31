"use client";

import type { WikiSearchResult } from "@/lib/markdown";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import styles from "./WikiSearch.module.css";

interface WikiSearchProps {
  onResults?: (results: WikiSearchResult[]) => void;
  currentVersion?: string;
}

export function WikiSearch({
  onResults,
  currentVersion = "latest",
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
        if (!response.ok)
          throw new Error(`Search failed: ${response.status}`);
        const searchResults = await response.json();
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
        !aborted && setIsLoading(false);
      }
    };
    runSearch();
    return () => {
      aborted = true;
    };
  }, [debouncedQuery, onResults, currentVersion]);

  const handleResultClick = useCallback(
    (result: WikiSearchResult) => {
      const { page } = result;
      const href = `/wiki/${currentVersion}/${page.slug.join("/")}`;
      const searchSnapshot = query.trim().toLowerCase();
      setQuery("");
      router.push(href);

      if (result.matchType === "content" && result.snippet && searchSnapshot) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            const contentContainer
              = document.querySelector(".main-wiki-content");
            if (!contentContainer)
              return;
            const elements = contentContainer.querySelectorAll(
              "p, h1, h2, h3, h4, h5, h6, li, td, th",
            );
            for (const element of Array.from(elements)) {
              if (element.textContent?.toLowerCase().includes(searchSnapshot)) {
                if (contentContainer instanceof HTMLElement) {
                  const targetOffset
                    = (element as HTMLElement).offsetTop
                      - contentContainer.offsetTop;
                  contentContainer.scrollTo({
                    top: targetOffset,
                    behavior: "smooth",
                  });
                }
                element.classList.add(styles.wikiHighlightTemp);
                setTimeout(() => {
                  element.classList.remove(styles.wikiHighlightTemp);
                }, 1800);
                break;
              }
            }
          }, 600); // shorter delay with rAF pre-step
        });
      }
    },
    [currentVersion, query, router],
  );

  return (
    <div className="relative" aria-label="Wiki search component">
      <InputGroup>
        <InputGroupInput
          type="text"
          aria-label="Search documentation"
          placeholder="Search documentation..."
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setQuery(e.target.value)}
          className="w-full"
        />
        <InputGroupAddon>
          <svg
            className="size-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <title>Search</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </InputGroupAddon>
      </InputGroup>

      {query && (
        <div
          className="absolute top-full right-0 left-0 z-20 mt-2 max-h-96 overflow-y-auto rounded-lg border bg-background shadow-lg"
          role="listbox"
          aria-label="Search results"
        >
          {isLoading
            ? (
                <div className="p-4 text-center text-muted-foreground">
                  Searching...
                </div>
              )
            : results.length > 0
              ? (
                  <div className="p-2">
                    {results.map((result) => {
                      const { page } = result;
                      const href = `/wiki/${currentVersion}/${page.slug.join("/")}`;
                      return (
                        <Link
                          prefetch={false}
                          key={page.slug.join("/")}
                          href={href}
                          onClick={(e) => {
                            e.preventDefault();
                            handleResultClick(result);
                          }}
                          className="hover:bg-default-100 focus:bg-default-200 block cursor-pointer rounded-md p-3 transition-colors focus:outline-none"
                          role="option"
                          aria-selected={false}
                        >
                          <div className="text-sm font-medium">{page.title}</div>
                          <div
                            className="mt-1 line-clamp-2 text-xs text-muted-foreground"
                            dangerouslySetInnerHTML={{
                              __html: result.highlightedSnippet,
                            }}
                          />
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              /
                              {page.slug.join("/")}
                            </span>
                            {page.version && page.version !== "latest" && (
                              <span className="bg-primary-100 text-primary-700 rounded px-1 py-0.5 text-xs">
                                {page.version}
                              </span>
                            )}
                            <span className="text-muted-foreground">
                              {result.matchType === "title"
                                ? "Found in title"
                                : "Found in content"}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )
              : (
                  <div className="p-4 text-center text-muted-foreground">
                    No results found
                  </div>
                )}
        </div>
      )}
    </div>
  );
}
