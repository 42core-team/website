"use client";

import type { WikiNavItem, WikiTocItem, WikiVersion } from "@/lib/wiki/types";
import { Menu } from "lucide-react";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavbar } from "@/contexts/NavbarContext";
import { cn } from "@/lib/utils";
import { useWikiContentInteractions } from "./useWikiContentInteractions";
import { VersionSelector } from "./VersionSelector";
import { WikiNavigation } from "./WikiNavigation";
import { WikiSearch } from "./WikiSearch";

const SIDEBAR_SCROLL_KEY = "wiki-sidebar-scroll";

interface WikiLayoutProps {
  children: React.ReactNode;
  navigation: WikiNavItem[];
  currentSlug: string[];
  currentVersion: string;
  versions: WikiVersion[];
  tableOfContents: WikiTocItem[];
}

export function WikiLayout({
  children,
  navigation,
  currentSlug,
  currentVersion,
  versions,
  tableOfContents,
}: WikiLayoutProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const { isBasicNavbarMenuOpen } = useNavbar();
  const sidebarRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLElement>(null);

  useWikiContentInteractions(contentRef);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar)
      return;

    let timeoutId: NodeJS.Timeout;

    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        try {
          sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(sidebar.scrollTop));
        }
        catch {
          // Ignore sessionStorage errors.
        }
      }, 120);
    };

    sidebar.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      sidebar.removeEventListener("scroll", handleScroll);
      clearTimeout(timeoutId);
    };
  }, []);

  useLayoutEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar)
      return;

    try {
      const savedScroll = sessionStorage.getItem(SIDEBAR_SCROLL_KEY);
      if (savedScroll) {
        sidebar.scrollTop = Number(savedScroll);
      }
    }
    catch {
      // Ignore sessionStorage errors.
    }
  }, []);

  return (
    <div
      data-wiki-shell="true"
      className="relative flex h-[calc(100vh-var(--navbar-height))] overflow-hidden"
    >
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden",
          isMobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setIsMobileNavOpen(false)}
      />

      <aside
        ref={sidebarRef}
        data-wiki-sidebar="true"
        className={cn(
          "fixed top-(--navbar-height) left-0 z-50 h-[calc(100vh-var(--navbar-height))] w-(--sidebar-width) overflow-x-hidden overflow-y-auto overscroll-contain border-r transition-transform duration-300 ease-out lg:static lg:z-0 lg:translate-x-0 lg:shrink-0",
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <WikiNavigation
          items={navigation}
          currentSlug={currentSlug}
          currentVersion={currentVersion}
          tableOfContents={tableOfContents}
          onItemClick={() => setIsMobileNavOpen(false)}
        />
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          data-wiki-toolbar="true"
          className={cn(
            "relative z-30 shrink-0 border-b px-4 py-3 transition-opacity duration-300 sm:px-6",
            isBasicNavbarMenuOpen
              ? "pointer-events-none opacity-0 lg:pointer-events-auto lg:opacity-100"
              : "opacity-100",
          )}
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsMobileNavOpen(open => !open)}
              className="lg:hidden"
              aria-label="Toggle wiki navigation"
              aria-expanded={isMobileNavOpen}
            >
              <Menu className="size-5" />
            </Button>

            <div className="min-w-[14rem] flex-1">
              <WikiSearch currentVersion={currentVersion} />
            </div>

            <div className="ml-auto">
              <VersionSelector
                versions={versions}
                currentVersion={currentVersion}
              />
            </div>
          </div>
        </header>

        <main
          ref={contentRef}
          data-wiki-scroll-container="true"
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6"
        >
          <div
            className="mx-auto w-full max-w-5xl"
            style={{ viewTransitionName: "wiki-content" }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
