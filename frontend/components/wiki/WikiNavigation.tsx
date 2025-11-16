import type { WikiNavItem } from "@/lib/markdown";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const INDENT_BASE = 8; // px
const INDENT_STEP = 10; // px per depth level

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

  // Track which heading is currently visible
  useEffect(() => {
    if (toc.length === 0)
      return;

    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      if (isScrollingRef.current)
        return;

      const intersectingEntries = entries.filter(e => e.isIntersecting);
      if (intersectingEntries.length === 0)
        return;

      // The ideal position is 100px from the top, matching the scroll-margin-top
      const idealPosition = 100;

      // Find the entry closest to the ideal position
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
        // Ensure the active TOC link in the sidebar is visible
        requestAnimationFrame(() => {
          const activeLink = document.querySelector(`a[href="#${newId}"]`);
          if (activeLink instanceof HTMLElement) {
            const contentContainer = document.querySelector(
              ".wiki-sidebar-navigation",
            );

            if (contentContainer instanceof HTMLElement) {
              const offset
                = activeLink.offsetTop
                  - contentContainer.clientHeight / 2
                  + activeLink.clientHeight / 2;
              contentContainer.scrollTo({
                top: offset,
                behavior: "smooth",
              });
            }
          }
        });
      }
    };

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: "0px 0px -80% 0px", // Observe the top 20% of the viewport
    });

    toc.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element)
        observer.observe(element);
    });

    return () => {
      observer.disconnect();
    };
  }, [toc]);

  const handleTocClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    isScrollingRef.current = true;
    setActiveId(id); // Immediate feedback

    const element = document.getElementById(id);
    const contentContainer = document.querySelector(".main-wiki-content");
    if (element && contentContainer instanceof HTMLElement) {
      const targetOffset = element.offsetTop - contentContainer.offsetTop;
      contentContainer.scrollTo({
        top: targetOffset,
        behavior: "smooth",
      });
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
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] transition-colors hover:bg-default-100 ${
              isActive
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
            <div className="ml-1 sm:ml-2 mt-1 mb-2  border border-default-200 rounded-md p-2">
              <div className="text-xs font-semibold text-muted-foreground mb-2 px-2 py-1 bg-default-100 rounded">
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
                    className={`block text-xs px-2 py-1 rounded-xs transition-colors hover:bg-default-100 hover:text-primary cursor-pointer ${
                      activeId === tocItem.id
                        ? "text-primary font-medium bg-primary-50 border-l-2 border-primary"
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
          defaultValue={itemPath} // open by default
          className="px-0"
        >
          <AccordionItem value={itemPath} className="border-none">
            <AccordionTrigger
              className="py-2 px-2.5 text-[13px] font-semibold hover:no-underline"
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
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] transition-colors hover:bg-default-100 ${
          isActive ? "bg-primary-50 text-primary-600" : "text-muted-foreground"
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
      className="wiki-sidebar-navigation w-66 h-full overflow-y-auto border-r bg-content1"
      aria-label="Wiki sidebar navigation"
      role="navigation"
    >
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Wiki</h2>
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
