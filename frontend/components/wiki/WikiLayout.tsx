"use client";

import type { WikiNavItem, WikiVersion } from "@/lib/markdown";
import { Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavbar } from "@/contexts/NavbarContext";
import { VersionSelector } from "./VersionSelector";
import { WikiNavigation } from "./WikiNavigation";
import { WikiSearch } from "./WikiSearch";

interface WikiLayoutProps {
  children: React.ReactNode;
  navigation: WikiNavItem[];
  currentSlug: string[];
  versions?: WikiVersion[];
  currentVersion?: string;
  pageContent?: string; // Add page content for table of contents
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
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);

  const updateSidebarShadows = useCallback(() => {
    const el = sidebarRef.current;
    if (!el)
      return;
    setShowTopShadow(el.scrollTop > 0);
    setShowBottomShadow(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  }, []);

  useEffect(() => {
    const el = sidebarRef.current;
    if (!el)
      return;
    updateSidebarShadows();
    el.addEventListener("scroll", updateSidebarShadows, { passive: true });
    return () => el.removeEventListener("scroll", updateSidebarShadows);
  }, [updateSidebarShadows]);

  // Ensure clicks on in-content heading anchors smooth-scroll to the target
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

  // Intercept in-content wiki links to enable Next.js client-side navigation
  useEffect(() => {
    const container = document.querySelector(".main-wiki-content");
    if (!container)
      return;

    const handleClick = (e: MouseEvent) => {
      // Respect modifier keys and non-left clicks (open in new tab, etc.)
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
      // Skip external links, hash links, and already-handled anchors
      if (!href || href.startsWith("http") || href.startsWith("#"))
        return;

      // Only intercept internal wiki links
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
    <div className="flex min-h-[calc(100vh-60px)] bg-background">
      {/* Mobile Navigation Overlay */}
      {isMobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 lg:hidden"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        ref={sidebarRef}
        className={`
          fixed lg:sticky top-[60px] left-0 z-50 lg:z-0
          w-64 h-[calc(100vh-60px)]
          bg-background border-r
          transform lg:transform-none transition-transform duration-300 ease-in-out
          ${isMobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          overflow-y-auto overflow-x-hidden
        `}
      >
        {/* Scroll shadow top */}
        <div
          className={`sticky top-0 z-10 h-4 -mb-4 pointer-events-none transition-opacity duration-300 ${
            showTopShadow ? "opacity-100" : "opacity-0"
          }`}
          style={{ background: "linear-gradient(to bottom, var(--color-background), transparent)" }}
        />

        <WikiNavigation
          items={navigation}
          currentSlug={currentSlug}
          currentVersion={currentVersion}
          pageContent={pageContent}
          onItemClick={() => setIsMobileNavOpen(false)}
        />

        {/* Scroll shadow bottom */}
        <div
          className={`sticky bottom-0 z-10 h-4 -mt-4 pointer-events-none transition-opacity duration-300 ${
            showBottomShadow ? "opacity-100" : "opacity-0"
          }`}
          style={{ background: "linear-gradient(to top, var(--color-background), transparent)" }}
        />
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header with Search and Version Selector */}
        <header
          className={`sticky top-[60px] z-40 border-b shadow-sm bg-content1 p-4 transition-opacity duration-300 ${
            isBasicNavbarMenuOpen
              ? "opacity-0 pointer-events-none lg:opacity-100 lg:pointer-events-auto"
              : "opacity-100"
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
              className="lg:hidden"
              aria-label="Toggle navigation"
              aria-expanded={isMobileNavOpen}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex-1 max-w-md">
              <WikiSearch currentVersion={currentVersion} />
            </div>

            {/* Version Selector */}
            {versions.length > 1 && (
              <VersionSelector
                versions={versions}
                currentVersion={currentVersion}
              />
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className="main-wiki-content flex-1 p-4 sm:p-6">
          <div className="max-w-4xl mx-auto" style={{ viewTransitionName: "wiki-content" }}>{children}</div>
        </main>
      </div>
    </div>
  );
}
