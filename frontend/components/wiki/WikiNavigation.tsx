"use client";

import type { WikiNavItem } from "@/lib/markdown";
import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { scrollToWikiHeading } from "@/lib/wiki-scroll";

const INDENT_BASE = 8; // px
const INDENT_STEP = 10; // px per depth level
const NAV_ACCORDION_KEY = "wiki-nav-accordion-closed";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface WikiNavigationProps {
  items: WikiNavItem[];
  currentSlug: string[];
  currentVersion?: string;
  pageContent?: string; // Add page content for table of contents
  onItemClick?: () => void; // Callback for mobile navigation
}

export function WikiNavigation({
  items,
  currentSlug,
  currentVersion = "latest",
  pageContent,
  onItemClick,
}: WikiNavigationProps) {
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track which accordions the user has explicitly closed (default: all open).
  // Initialised synchronously from sessionStorage so the first render already
  // has the correct open/closed state (avoids a visible flash / layout shift).
  const [closedAccordions, setClosedAccordions] = useState<Set<string>>(
    () => {
      if (typeof window === "undefined")
        return new Set();
      try {
        const stored = sessionStorage.getItem(NAV_ACCORDION_KEY);
        if (stored)
          return new Set(JSON.parse(stored));
      }
      catch {
        // Ignore sessionStorage errors
      }
      return new Set();
    },
  );

  // Handle accordion open/close and persist to sessionStorage
  const handleAccordionChange = useCallback(
    (itemPath: string, value: string) => {
      setClosedAccordions((prev) => {
        const next = new Set(prev);
        if (!value) {
          next.add(itemPath);
        }
        else {
          next.delete(itemPath);
        }
        try {
          sessionStorage.setItem(
            NAV_ACCORDION_KEY,
            JSON.stringify([...next]),
          );
        }
        catch {
          // Ignore sessionStorage errors
        }
        return next;
      });
    },
    [],
  );

  // Parse table of contents from page content
  useEffect(() => {
    if (!pageContent) {
      setToc([]);
      return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(pageContent, "text/html");
    const headings = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");

    const tocItems: TocItem[] = Array.from(headings)
      .map(heading => ({
        id: heading.id,
        text: heading.textContent || "",
        level: Number.parseInt(heading.tagName.charAt(1)),
      }))
      .filter(item => item.id && item.text);

    setToc(tocItems);
  }, [pageContent]);

  // Scroll the sidebar so the active TOC link is visible
  const scrollActiveLinkIntoView = useCallback((id: string) => {
    requestAnimationFrame(() => {
      const activeLink = document.querySelector(`a[href="#${id}"]`);
      if (activeLink instanceof HTMLElement) {
        activeLink.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
  }, []);

  // Track which heading is currently visible
  useEffect(() => {
    if (toc.length === 0)
      return;

    // Set initial active heading on mount by finding the first one in/near the viewport
    const idealPosition = 100;
    let bestId = toc[0]?.id ?? "";
    let bestDistance = Infinity;
    for (const { id } of toc) {
      const el = document.getElementById(id);
      if (!el)
        continue;
      const dist = Math.abs(el.getBoundingClientRect().top - idealPosition);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestId = id;
      }
    }
    if (bestId) {
      setActiveId(bestId);
      scrollActiveLinkIntoView(bestId);
    }

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      if (isScrollingRef.current)
        return;

      const intersectingEntries = entries.filter(e => e.isIntersecting);
      if (intersectingEntries.length === 0)
        return;

      const closestEntry = intersectingEntries.reduce((prev, curr) => {
        const prevDistance = Math.abs(
          prev.boundingClientRect.top - idealPosition,
        );
        const currDistance = Math.abs(
          curr.boundingClientRect.top - idealPosition,
        );
        return currDistance < prevDistance ? curr : prev;
      });

      if (closestEntry) {
        const newId = closestEntry.target.id;
        setActiveId(newId);
        scrollActiveLinkIntoView(newId);
      }
    };

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: "0px 0px -80% 0px",
    });

    toc.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element)
        observer.observe(element);
    });

    return () => {
      observer.disconnect();
    };
  }, [toc, scrollActiveLinkIntoView]);

  const handleTocClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    isScrollingRef.current = true;
    setActiveId(id); // Immediate feedback

    const element = document.getElementById(id);
    if (element) {
      scrollToWikiHeading(element);
    }

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 400); // A generous timeout for smooth scrolling
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Remove version from currentSlug to get the actual page path
  const getPagePath = (slug: string[]) => {
    return slug.join("/");
  };

  const currentPath = getPagePath(currentSlug);

  // Helper function to generate version-aware URLs
  const getVersionAwareUrl = (itemPath: string) => {
    return `/wiki/${currentVersion}/${itemPath}`;
  };

  const renderNavItem = (
    item: WikiNavItem,
    depth: number = 0,
    index: number = 0,
  ) => {
    const itemPath = item.slug.join("/");
    const uniqueKey = `${itemPath}-${depth}-${index}-${item.isFile ? "file" : "dir"}`;
    const isActive = currentPath === itemPath;

    if (item.isFile) {
      return (
        <div key={uniqueKey}>
          <Link
            href={getVersionAwareUrl(itemPath)}
            onClick={onItemClick}
            className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors hover:bg-default-100 ${isActive
              ? "bg-primary-50 text-primary-600"
              : "text-muted-foreground"
            }`}
            style={{
              paddingLeft: `${INDENT_BASE + depth * INDENT_STEP}px`,
            }}
          >
            {item.title}
          </Link>

          {/* Show table of contents under the active page */}
          {isActive && toc.length > 0 && (
            <div className="mt-1 mb-2 ml-1 rounded-md border p-2 sm:ml-2">
              <div className="mb-2 rounded bg-default-100 px-2 py-1 text-xs font-semibold text-muted-foreground">
                On this page
              </div>
              <div className="space-y-0.5">
                {toc.map((tocItem, index) => (
                  <a
                    key={`toc-${index}-${tocItem.id.replace(/[^\w-]/g, "_")}`}
                    href={`#${tocItem.id}`}
                    onClick={(e) => {
                      handleTocClick(tocItem.id, e);
                      onItemClick?.();
                    }}
                    className={`block cursor-pointer rounded-xs px-2 py-1 text-xs transition-colors hover:bg-default-100 hover:text-primary ${activeId === tocItem.id
                      ? "border-l-2 border-primary bg-primary-50 font-medium text-primary"
                      : "text-muted-foreground"
                    }`}
                    style={{
                      paddingLeft: `${Math.min((tocItem.level - 1) * 8 + 8, 32)}px`,
                    }}
                  >
                    {tocItem.text}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (item.children && item.children.length > 0) {
      // Shadcn Accordion usage: single root per directory item with one item inside.
      // We keep each directory expanded by default (can be collapsed by user).
      return (
        <Accordion
          key={uniqueKey}
          type="single"
          collapsible
          value={closedAccordions.has(itemPath) ? "" : itemPath}
          onValueChange={val => handleAccordionChange(itemPath, val)}
          className="px-0"
        >
          <AccordionItem value={itemPath} className="border-none">
            <AccordionTrigger
              className="px-2.5 py-2 text-[13px] font-semibold hover:no-underline"
              style={{
                paddingLeft: `${INDENT_BASE + depth * INDENT_STEP}px`,
              }}
            >
              {item.title}
            </AccordionTrigger>
            <AccordionContent className="pt-0 pb-0">
              <div>
                {item.children.map((child, index) => (
                  <React.Fragment key={`${item.slug.join("/")}-child-${index}`}>
                    {renderNavItem(child, depth + 1, index)}
                  </React.Fragment>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      );
    }

    return (
      <Link
        key={uniqueKey}
        href={getVersionAwareUrl(itemPath)}
        onClick={onItemClick}
        className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors hover:bg-default-100 ${isActive ? "bg-primary-50 text-primary-600" : "text-muted-foreground"
        }`}
        style={{
          paddingLeft: `${INDENT_BASE + depth * INDENT_STEP}px`,
        }}
      >
        {item.title}
      </Link>
    );
  };

  return (
    <nav
      className="wiki-sidebar-navigation h-full w-66 border-r"
      aria-label="Wiki sidebar navigation"
      role="navigation"
    >
      <div className="p-4">
        <h2 className="mb-4 text-lg font-semibold">Wiki</h2>
        <div className="space-y-1">
          {items.map((item, index) => (
            <React.Fragment key={`root-${index}-${item.slug.join("/")}`}>
              {renderNavItem(item, 0, index)}
            </React.Fragment>
          ))}
        </div>
      </div>
    </nav>
  );
}
