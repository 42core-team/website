"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WikiNavigation } from "./WikiNavigation";
import { WikiSearch } from "./WikiSearch";
import { WikiNavItem, WikiVersion } from "@/lib/markdown";
import { buildVersionPath } from "@/lib/wiki-navigation";
import { useNavbar } from "@/contexts/NavbarContext";

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
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
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

  const handleVersionChange = (newVersion: string) => {
    if (newVersion === currentVersion) return;

    const newPath = buildVersionPath(
      window.location.pathname,
      newVersion,
      versions,
    );
    router.push(newPath);
    setIsVersionDropdownOpen(false);
  };

  return (
    <div className="flex bg-background">
      {/* Mobile Navigation Overlay */}
      {isMobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 lg:hidden"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <div
        className={`
        fixed lg:sticky top-[60px] left-0 z-50 lg:z-0
        w-66 h-[calc(100vh-60px)]
        transform lg:transform-none transition-transform duration-300 ease-in-out
        ${isMobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        shrink-0
        overflow-y-auto overflow-x-hidden wrap-break-word whitespace-normal
      `}
      >
        <WikiNavigation
          items={navigation}
          currentSlug={currentSlug}
          currentVersion={currentVersion}
          pageContent={pageContent}
          onItemClick={() => setIsMobileNavOpen(false)}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 lg:ml-0 flex flex-col h-[calc(100vh-60px)]">
        {/* Header with Search and Version Selector */}
        <header
          className={`border-b border-divider bg-content1 p-4 shadow-xs sticky top-[60px] z-40 transition-opacity duration-300 ${isBasicNavbarMenuOpen ? "opacity-0 pointer-events-none lg:opacity-100 lg:pointer-events-auto" : "opacity-100"}`}
        >
          <div className="flex items-center justify-between gap-4">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
              className="lg:hidden p-2 rounded-md hover:bg-default-100 transition-colors"
              aria-label="Toggle navigation"
              aria-expanded={isMobileNavOpen}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            <div className="flex-1 max-w-md">
              <WikiSearch currentVersion={currentVersion} />
            </div>

            {/* Version Selector - Desktop: Direct dropdown, Mobile: Icon */}
            {versions.length > 1 && (
              <div className="relative">
                {/* Desktop Version Selector */}
                <div className="hidden lg:block relative">
                  <button
                    onClick={() =>
                      setIsVersionDropdownOpen(!isVersionDropdownOpen)
                    }
                    className="px-3 py-2 text-sm rounded-md border border-divider hover:bg-default-100 transition-colors flex items-center gap-2"
                  >
                    {versions.find((v) => v.slug === currentVersion)?.name ||
                      "Select Version"}
                    <svg
                      className={`w-4 h-4 transition-transform ${isVersionDropdownOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {/* Desktop Dropdown Menu */}
                  {isVersionDropdownOpen && (
                    <>
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsVersionDropdownOpen(false)}
                      />

                      {/* Dropdown Menu */}
                      <div className="absolute right-0 top-full mt-2 bg-content1 border border-divider rounded-lg shadow-lg min-w-48 z-20">
                        <div className="p-2">
                          <div className="text-xs font-semibold text-default-600 mb-2 px-2">
                            Select Version
                          </div>
                          {versions.map((version) => (
                            <button
                              key={version.slug}
                              onClick={() => handleVersionChange(version.slug)}
                              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors hover:bg-default-100 ${
                                currentVersion === version.slug
                                  ? "bg-primary-50 text-primary-600"
                                  : "text-default-700"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span>{version.name}</span>
                                {currentVersion === version.slug && (
                                  <svg
                                    className="w-4 h-4 text-primary-600"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Mobile Version Selector - Icon Only */}
                <div className="lg:hidden relative">
                  <button
                    onClick={() =>
                      setIsVersionDropdownOpen(!isVersionDropdownOpen)
                    }
                    className="p-2 rounded-md hover:bg-default-100 transition-colors"
                    aria-label="Select version"
                    title="Select version"
                  >
                    <svg
                      className="w-5 h-5 text-default-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7h-4V3"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 12h4"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 16h2"
                      />
                    </svg>
                  </button>

                  {/* Mobile Dropdown Menu */}
                  {isVersionDropdownOpen && (
                    <>
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsVersionDropdownOpen(false)}
                      />

                      {/* Dropdown Menu */}
                      <div className="absolute right-0 top-full mt-2 bg-content1 border border-divider rounded-lg shadow-lg min-w-48 z-20">
                        <div className="p-2">
                          <div className="text-xs font-semibold text-default-600 mb-2 px-2">
                            Select Version
                          </div>
                          {versions.map((version) => (
                            <button
                              key={version.slug}
                              onClick={() => handleVersionChange(version.slug)}
                              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors hover:bg-default-100 ${
                                currentVersion === version.slug
                                  ? "bg-primary-50 text-primary-600"
                                  : "text-default-700"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span>{version.name}</span>
                                {currentVersion === version.slug && (
                                  <svg
                                    className="w-4 h-4 text-primary-600"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className="main-wiki-content flex-1 overflow-y-auto p-4 sm:p-6 bg-background">
          <div className="max-w-4xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
