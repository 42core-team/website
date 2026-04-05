"use client";

import type { WikiNavItem, WikiVersion } from "@/lib/markdown";
import { Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavbar } from "@/contexts/NavbarContext";
import { cn } from "@/lib/utils";
import { VersionSelector } from "./VersionSelector";
import { WikiNavigation } from "./WikiNavigation";
import { WikiSearch } from "./WikiSearch";

const SIDEBAR_SCROLL_KEY = "wiki-sidebar-scroll";

interface WikiLayoutProps {
  children: React.ReactNode;
  navigation: WikiNavItem[];
  currentSlug: string[];
  versions?: WikiVersion[];
  currentVersion?: string;
  pageContent?: string;
}

export function WikiLayout({
  children,
  navigation,
  currentSlug,
  versions = [],
  currentVersion = "latest",
  pageContent,
}: WikiLayoutProps) {
  const router = useRouter();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const { isBasicNavbarMenuOpen } = useNavbar();
  const sidebarRef = useRef<HTMLElement>(null);

  // Save sidebar scroll position on scroll (debounced)
  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar)
      return;

    let timeoutId: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        try {
          sessionStorage.setItem(
            SIDEBAR_SCROLL_KEY,
            String(sidebar.scrollTop),
          );
        }
        catch {
          // Ignore sessionStorage errors
        }
      }, 100);
    };

    sidebar.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      sidebar.removeEventListener("scroll", handleScroll);
      clearTimeout(timeoutId);
    };
  }, []);

  // Restore sidebar scroll position before the browser paints.
  // Because WikiNavigation now initialises its accordion state synchronously
  // (lazy useState), the DOM heights are already correct on the first render,
  // so we can set scrollTop immediately in useLayoutEffect – no delay needed.
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
      // Ignore sessionStorage errors
    }
  }, []);

  useEffect(() => {
    const container = document.querySelector(".main-wiki-content");
    if (!container)
      return;

    const links = container.querySelectorAll("a.heading-anchor");
    const handleClick = (e: Event) => {
      e.preventDefault();
      const href = (e.currentTarget as HTMLAnchorElement).getAttribute("href");
      const targetId = href?.startsWith("#") ? href.slice(1) : null;
      if (targetId) {
        const target = document.getElementById(targetId);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    };

    links.forEach(link => link.addEventListener("click", handleClick));
    return () => {
      links.forEach(link => link.removeEventListener("click", handleClick));
    };
  }, []);

  // ── Tabbed code-group switching (rehype-code-group) ──────────────────────
  // The plugin ships its own DOMContentLoaded script, but it doesn't fire in
  // our Next.js SPA context. We replicate the logic here via event delegation.
  useEffect(() => {
    const container = document.querySelector(".main-wiki-content");
    if (!container)
      return;

    const activateTab = (tab: HTMLElement) => {
      const group = tab.closest(".rehype-code-group");
      if (!group)
        return;

      const tabs = group.querySelectorAll<HTMLElement>(".rcg-tab");
      const blocks = group.querySelectorAll<HTMLElement>(".rcg-block");
      const idx = Array.from(tabs).indexOf(tab);
      if (idx === -1)
        return;

      // Deactivate all tabs & panels
      tabs.forEach((t) => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      blocks.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("hidden", "true");
      });

      // Activate the selected tab & panel
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      blocks[idx].classList.add("active");
      blocks[idx].removeAttribute("hidden");
    };

    const handleTabClick = (e: MouseEvent) => {
      const tab = (e.target as HTMLElement).closest(".rcg-tab") as HTMLElement | null;
      if (tab)
        activateTab(tab);
    };

    const handleTabKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains("rcg-tab"))
        return;

      const group = target.closest(".rehype-code-group");
      if (!group)
        return;

      const tabs = Array.from(group.querySelectorAll<HTMLElement>(".rcg-tab"));
      const idx = tabs.indexOf(target);
      let next: number | null = null;

      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          next = (idx + 1) % tabs.length;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          next = (idx - 1 + tabs.length) % tabs.length;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = tabs.length - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      tabs[next].focus();
      activateTab(tabs[next]);
    };

    container.addEventListener("click", handleTabClick as EventListener);
    container.addEventListener("keydown", handleTabKeyDown as EventListener);
    return () => {
      container.removeEventListener("click", handleTabClick as EventListener);
      container.removeEventListener("keydown", handleTabKeyDown as EventListener);
    };
  }, []);

  useEffect(() => {
    const container = document.querySelector(".main-wiki-content");
    if (!container)
      return;

    const handleClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented
        || e.metaKey
        || e.ctrlKey
        || e.shiftKey
        || e.altKey
        || e.button !== 0
      ) {
        return;
      }

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor)
        return;

      const href = anchor.getAttribute("href") || "";
      if (!href || href.startsWith("http") || href.startsWith("#"))
        return;

      if (!href.startsWith("/wiki/"))
        return;

      e.preventDefault();
      router.push(href);
    };

    container.addEventListener("click", handleClick as EventListener);
    return () => {
      container.removeEventListener("click", handleClick as EventListener);
    };
  }, [router]);

  return (
    <div className="relative flex min-h-[calc(100vh-var(--navbar-height))]">
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/50 transition-opacity duration-300 lg:hidden",
          isMobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setIsMobileNavOpen(false)}
      />

      <aside
        ref={sidebarRef}
        className={cn(
          "fixed top-(--navbar-height) left-0 z-50 h-[calc(100vh-var(--navbar-height))] w-(--sidebar-width) overflow-x-hidden overflow-y-auto border-r bg-background transition-transform duration-300 ease-in-out lg:sticky lg:z-0 lg:translate-x-0 lg:self-start",
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <WikiNavigation
          items={navigation}
          currentSlug={currentSlug}
          currentVersion={currentVersion}
          pageContent={pageContent}
          onItemClick={() => setIsMobileNavOpen(false)}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "sticky top-(--navbar-height) z-40 border-b bg-background/95 py-4 shadow-sm backdrop-blur transition-opacity duration-300 supports-backdrop-filter:bg-background/60 sm:p-4",
            isBasicNavbarMenuOpen
              ? "pointer-events-none opacity-0 lg:pointer-events-auto lg:opacity-100"
              : "opacity-100",
          )}
        >
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
              className="lg:hidden"
              aria-label="Toggle navigation"
              aria-expanded={isMobileNavOpen}
            >
              <Menu className="size-5" />
            </Button>
            <div className="max-w-md flex-1">
              <WikiSearch currentVersion={currentVersion} />
            </div>
            {versions.length > 1 && (
              <VersionSelector
                versions={versions}
                currentVersion={currentVersion}
              />
            )}
          </div>
        </header>

        <main className="main-wiki-content flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-4xl" style={{ viewTransitionName: "wiki-content" }}>{children}</div>
        </main>
      </div>
    </div>
  );
}
