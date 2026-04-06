"use client";

import type { WikiNavItem, WikiTocItem } from "@/lib/wiki/types";
import Link from "next/link";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getWikiScrollContainer, scrollToWikiHeading } from "@/lib/wiki-scroll";
import { buildWikiPath } from "@/lib/wiki/shared-paths";

const INDENT_BASE = 12;
const INDENT_STEP = 12;
const NAV_ACCORDION_KEY = "wiki-nav-accordion-closed";

interface WikiNavigationProps {
  items: WikiNavItem[];
  currentSlug: string[];
  currentVersion: string;
  tableOfContents: WikiTocItem[];
  onItemClick?: () => void;
}

export function WikiNavigation({
  items,
  currentSlug,
  currentVersion,
  tableOfContents,
  onItemClick,
}: WikiNavigationProps) {
  const [activeId, setActiveId] = useState("");
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [closedAccordions, setClosedAccordions] = useState<Set<string>>(() => {
    if (typeof window === "undefined") {
      return new Set();
    }

    try {
      const stored = sessionStorage.getItem(NAV_ACCORDION_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    }
    catch {
      return new Set();
    }
  });

  const currentPath = currentSlug.join("/");

  const handleAccordionChange = useCallback((itemPath: string, value: string) => {
    setClosedAccordions((previous) => {
      const next = new Set(previous);

      if (!value) {
        next.add(itemPath);
      }
      else {
        next.delete(itemPath);
      }

      try {
        sessionStorage.setItem(NAV_ACCORDION_KEY, JSON.stringify([...next]));
      }
      catch {
        // Ignore sessionStorage errors.
      }

      return next;
    });
  }, []);

  const scrollActiveLinkIntoView = useCallback((id: string) => {
    requestAnimationFrame(() => {
      const activeLink = document.querySelector(`a[href="#${id}"]`);
      if (activeLink instanceof HTMLElement) {
        activeLink.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    });
  }, []);

  useEffect(() => {
    if (tableOfContents.length === 0) {
      setActiveId("");
      return;
    }

    const scrollRoot = getWikiScrollContainer();
    const rootTop = scrollRoot?.getBoundingClientRect().top ?? 0;
    const idealTop = rootTop + 96;
    const currentHash = window.location.hash.slice(1);
    const hashElement = currentHash
      ? document.getElementById(currentHash)
      : null;

    if (hashElement && tableOfContents.some(item => item.id === currentHash)) {
      setActiveId(currentHash);
      scrollActiveLinkIntoView(currentHash);
      isScrollingRef.current = true;
      scrollToWikiHeading(hashElement);

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false;
      }, 500);
    }
    else {
      let bestId = tableOfContents[0]?.id ?? "";
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const { id } of tableOfContents) {
        const element = document.getElementById(id);
        if (!element)
          continue;

        const distance = Math.abs(element.getBoundingClientRect().top - idealTop);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestId = id;
        }
      }

      if (bestId) {
        setActiveId(bestId);
        scrollActiveLinkIntoView(bestId);
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingRef.current)
          return;

        const visibleEntries = entries.filter(entry => entry.isIntersecting);
        if (visibleEntries.length === 0)
          return;

        const closestEntry = visibleEntries.reduce((closest, entry) => {
          const closestDistance = Math.abs(
            closest.boundingClientRect.top - idealTop,
          );
          const entryDistance = Math.abs(
            entry.boundingClientRect.top - idealTop,
          );

          return entryDistance < closestDistance ? entry : closest;
        });

        setActiveId(closestEntry.target.id);
        scrollActiveLinkIntoView(closestEntry.target.id);
      },
      {
        root: scrollRoot,
        rootMargin: "0px 0px -80% 0px",
      },
    );

    for (const { id } of tableOfContents) {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    }

    return () => {
      observer.disconnect();
    };
  }, [tableOfContents, scrollActiveLinkIntoView]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handleTocClick = (id: string, event: React.MouseEvent) => {
    event.preventDefault();
    isScrollingRef.current = true;
    setActiveId(id);
    history.replaceState(null, "", `#${id}`);

    const element = document.getElementById(id);
    if (element) {
      scrollToWikiHeading(element);
    }

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 400);
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
            href={buildWikiPath(currentVersion, item.slug)}
            onClick={onItemClick}
            className={cn(
              "block rounded-md px-3 py-2 text-[13px] leading-5 transition-colors",
              isActive
                ? "border-l-2 border-primary/70 bg-muted/70 font-medium text-foreground"
                : "text-muted-foreground hover:bg-foreground/6 hover:text-foreground",
            )}
            style={{ paddingLeft: `${INDENT_BASE + depth * INDENT_STEP}px` }}
          >
            {item.title}
          </Link>

          {isActive && tableOfContents.length > 0 && (
            <div className="mt-3 ml-2 rounded-md border border-border/70 bg-background/70 p-3">
              <div className="mb-2 px-2 text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
                On this page
              </div>
              <div className="space-y-1">
                {tableOfContents.map(tocItem => (
                  <a
                    key={tocItem.id}
                    href={`#${tocItem.id}`}
                    onClick={(event) => {
                      handleTocClick(tocItem.id, event);
                      onItemClick?.();
                    }}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-xs transition-colors",
                      activeId === tocItem.id
                        ? "border-l-2 border-primary/65 bg-transparent font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                    style={{
                      paddingLeft: `${Math.min((tocItem.level - 1) * 10 + 8, 36)}px`,
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
      return (
        <Accordion
          key={uniqueKey}
          type="single"
          collapsible
          value={closedAccordions.has(itemPath) ? "" : itemPath}
          onValueChange={value => handleAccordionChange(itemPath, value)}
          className="px-0"
        >
          <AccordionItem value={itemPath} className="border-none">
            <AccordionTrigger
              className="rounded-md px-3 py-2 text-[13px] font-semibold text-foreground hover:bg-foreground/4 hover:no-underline"
              style={{ paddingLeft: `${INDENT_BASE + depth * INDENT_STEP}px` }}
            >
              {item.title}
            </AccordionTrigger>
            <AccordionContent className="pt-1 pb-0">
              <div className="space-y-1">
                {item.children.map((child, childIndex) => (
                  <React.Fragment key={`${item.slug.join("/")}-child-${childIndex}`}>
                    {renderNavItem(child, depth + 1, childIndex)}
                  </React.Fragment>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      );
    }

    return null;
  };

  return (
    <nav className="h-full px-4 py-5" aria-label="Wiki navigation">
      <div className="mb-5 px-2">
        <div className="text-[11px] font-semibold tracking-[0.32em] text-muted-foreground uppercase">
          Documentation
        </div>
        <div className="mt-2 text-lg font-semibold tracking-tight text-foreground">
          CORE Wiki
        </div>
      </div>

      <div className="space-y-1">
        {items.map((item, index) => (
          <React.Fragment key={`root-${index}-${item.slug.join("/")}`}>
            {renderNavItem(item, 0, index)}
          </React.Fragment>
        ))}
      </div>
    </nav>
  );
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
