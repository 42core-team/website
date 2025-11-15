"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@heroui/input";
import { WikiSearchResult } from "@/lib/markdown";
import { useRouter } from "next/navigation";

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
  const router = useRouter();

  useEffect(() => {
    const searchPages = async () => {
      if (!query.trim()) {
        setResults([]);
        onResults?.([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/wiki/search?q=${encodeURIComponent(query)}&version=${encodeURIComponent(currentVersion)}`,
        );
        const searchResults = await response.json();
        setResults(searchResults);
        onResults?.(searchResults);
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
        onResults?.([]);
      }
      setIsLoading(false);
    };

    const debounceTimer = setTimeout(searchPages, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, onResults, currentVersion]);

  return (
    <div className="relative">
      <Input
        type="text"
        placeholder="Search documentation..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full"
        startContent={
          <svg
            className="w-4 h-4 text-default-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        }
      />

      {query && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-content1 border border-divider rounded-lg shadow-lg max-h-96 overflow-y-auto z-10">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Searching...
            </div>
          ) : results.length > 0 ? (
            <div className="p-2">
              {results.map((result) => {
                const { page } = result;
                // Always include version in URL path for consistency
                const href = `/wiki/${currentVersion}/${page.slug.join("/")}`;

                return (
                  <a
                    key={page.slug.join("/")}
                    href={href}
                    className="block p-3 hover:bg-default-100 rounded-md transition-colors cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      setQuery("");

                      // Navigate to the page
                      router.push(href);

                      // If it's a content match, try to highlight the found text after navigation
                      if (result.matchType === "content" && result.snippet) {
                        setTimeout(() => {
                          // Try to find and scroll to the text using a more robust method
                          const searchText = query.trim().toLowerCase();
                          const contentContainer =
                            document.querySelector(".main-wiki-content");
                          if (contentContainer == null) {
                            return;
                          }
                          const elements = contentContainer.querySelectorAll(
                            "p, h1, h2, h3, h4, h5, h6, li, td, th",
                          );

                          Array.from(elements).forEach((element) => {
                            if (
                              element.textContent
                                ?.toLowerCase()
                                .includes(searchText)
                            ) {
                              const docElement = document.getElementById(
                                element.id,
                              );
                              if (
                                docElement &&
                                contentContainer instanceof HTMLElement
                              ) {
                                const targetOffset =
                                  docElement.offsetTop -
                                  contentContainer.offsetTop;
                                contentContainer.scrollTo({
                                  top: targetOffset,
                                  behavior: "smooth",
                                });
                              }

                              // Temporarily highlight the element
                              const originalBg = (element as HTMLElement).style
                                .backgroundColor;
                              const originalBorder = (element as HTMLElement)
                                .style.border;
                              const originalOpacity = (element as HTMLElement)
                                .style.opacity;
                              (element as HTMLElement).style.backgroundColor =
                                "#fef3c7";
                              (element as HTMLElement).style.border =
                                "1px solid #e5e7eb";
                              (element as HTMLElement).style.borderRadius =
                                "4px";
                              (element as HTMLElement).style.transition =
                                "all 0.3s ease";
                              (element as HTMLElement).style.padding = "2px";
                              (element as HTMLElement).style.opacity = "0.65";

                              setTimeout(() => {
                                (element as HTMLElement).style.backgroundColor =
                                  originalBg;
                                (element as HTMLElement).style.border =
                                  originalBorder;
                                (element as HTMLElement).style.borderRadius =
                                  "";
                                (element as HTMLElement).style.padding = "";
                                (element as HTMLElement).style.opacity =
                                  originalOpacity;
                              }, 1800);

                              return; // Exit after first match
                            }
                          });
                        }, 800); // Wait longer for page to fully load
                      }
                    }}
                  >
                    <div className="font-medium text-sm text-default-700">
                      {page.title}
                    </div>

                    {/* Show snippet with highlighting */}
                    <div
                      className="text-xs text-default-600 mt-1 line-clamp-2"
                      dangerouslySetInnerHTML={{
                        __html: result.highlightedSnippet,
                      }}
                    />

                    <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                      <span>/{page.slug.join("/")}</span>
                      {page.version && page.version !== "latest" && (
                        <span className="bg-primary-100 text-primary-700 px-1 py-0.5 rounded text-xs">
                          {page.version}
                        </span>
                      )}
                      <span className="text-default-400">
                        {result.matchType === "title"
                          ? "Found in title"
                          : "Found in content"}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
