"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WikiNavigation } from "./WikiNavigation";
import { WikiSearch } from "./WikiSearch";
import { VersionSelector } from "./VersionSelector";
import { WikiNavItem, WikiVersion } from "@/lib/markdown";
import { useNavbar } from "@/contexts/NavbarContext";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  // Ensure clicks on in-content heading anchors scroll inside wiki-content only
  useEffect(() => {
    const container = document.querySelector(".main-wiki-content");
    if (!container) return;

    const links = container.querySelectorAll("a.heading-anchor");
    const handleClick = (e: Event) => {
      e.preventDefault();
      const href = (e.currentTarget as HTMLAnchorElement).getAttribute("href");
      const targetId = href?.startsWith("#") ? href.slice(1) : null;
      if (targetId) {
        const target = document.getElementById(targetId);
        if (target) {
          const offset =
            target.offsetTop - (container as HTMLElement).offsetTop;
          (container as HTMLElement).scrollTo({
            top: offset,
            behavior: "smooth",
          });
        }
      }
    };

    links.forEach((link) => link.addEventListener("click", handleClick));
    return () => {
      links.forEach((link) => link.removeEventListener("click", handleClick));
    };
  }, []);

  // Intercept in-content wiki links to enable Next.js client-side navigation
  useEffect(() => {
    const container = document.querySelector(".main-wiki-content");
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      // Respect modifier keys and non-left clicks (open in new tab, etc.)
      if (
        e.defaultPrevented ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey ||
        e.button !== 0
      ) {
        return;
      }

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href") || "";
      // Skip external links, hash links, and already-handled anchors
      if (!href || href.startsWith("http") || href.startsWith("#")) return;

      // Only intercept internal wiki links
      if (!href.startsWith("/wiki/")) return;

      e.preventDefault();
      router.push(href);
    };

    container.addEventListener("click", handleClick as EventListener);
    return () => {
      container.removeEventListener("click", handleClick as EventListener);
    };
  }, [router]);

  return (
    <div className="flex h-[calc(100vh-60px)] bg-background">
      {/* Mobile Navigation Overlay */}
      {isMobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 lg:hidden"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`
          fixed lg:sticky top-[60px] left-0 z-50 lg:z-0
          w-64 h-[calc(100vh-60px)]
          bg-background border-r 
          transform lg:transform-none transition-transform duration-300 ease-in-out
          ${isMobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          overflow-y-auto overflow-x-hidden
        `}
      >
        <WikiNavigation
          items={navigation}
          currentSlug={currentSlug}
          currentVersion={currentVersion}
          pageContent={pageContent}
          onItemClick={() => setIsMobileNavOpen(false)}
        />
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header with Search and Version Selector */}
        <header
          className={`sticky top-[60px] z-40 border-b bg-content1 p-4 transition-opacity duration-300 ${
            isBasicNavbarMenuOpen
              ? "opacity-0 pointer-events-none lg:opacity-100 lg:pointer-events-auto"
              : "opacity-100"
          }`}
        >
          <div className="flex items-center gap-4">
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
        <main className="main-wiki-content flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-4xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
