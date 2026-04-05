"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { scrollToWikiHeading } from "@/lib/wiki-scroll";

export function useWikiContentInteractions(
  contentRef: React.RefObject<HTMLElement | null>,
) {
  const router = useRouter();

  useEffect(() => {
    const container = contentRef.current;
    if (!container) {
      return;
    }

    const activateTab = (tab: HTMLElement) => {
      const group = tab.closest(".rehype-code-group");
      if (!group) {
        return;
      }

      const tabs = group.querySelectorAll<HTMLElement>(".rcg-tab");
      const blocks = group.querySelectorAll<HTMLElement>(".rcg-block");
      const selectedIndex = Array.from(tabs).indexOf(tab);

      if (selectedIndex === -1) {
        return;
      }

      tabs.forEach((item) => {
        item.classList.remove("active");
        item.setAttribute("aria-selected", "false");
      });
      blocks.forEach((item) => {
        item.classList.remove("active");
        item.setAttribute("hidden", "true");
      });

      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      blocks[selectedIndex]?.classList.add("active");
      blocks[selectedIndex]?.removeAttribute("hidden");
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target)
        return;

      const tab = target.closest(".rcg-tab") as HTMLElement | null;
      if (tab) {
        activateTab(tab);
        return;
      }

      if (
        event.defaultPrevented
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
        || event.button !== 0
      ) {
        return;
      }

      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor)
        return;

      const href = anchor.getAttribute("href") ?? "";

      if (anchor.classList.contains("heading-anchor") && href.startsWith("#")) {
        event.preventDefault();
        const targetId = href.slice(1);
        const heading = document.getElementById(targetId);

        if (heading) {
          history.replaceState(null, "", `#${targetId}`);
          scrollToWikiHeading(heading);
        }

        return;
      }

      if (!href.startsWith("/wiki/")) {
        return;
      }

      event.preventDefault();
      router.push(href, { scroll: false });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.classList.contains("rcg-tab")) {
        return;
      }

      const group = target.closest(".rehype-code-group");
      if (!group) {
        return;
      }

      const tabs = Array.from(group.querySelectorAll<HTMLElement>(".rcg-tab"));
      const activeIndex = tabs.indexOf(target);
      let nextIndex: number | null = null;

      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          nextIndex = (activeIndex + 1) % tabs.length;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          nextIndex = (activeIndex - 1 + tabs.length) % tabs.length;
          break;
        case "Home":
          nextIndex = 0;
          break;
        case "End":
          nextIndex = tabs.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      tabs[nextIndex]?.focus();
      if (tabs[nextIndex]) {
        activateTab(tabs[nextIndex]);
      }
    };

    container.addEventListener("click", handleClick as EventListener);
    container.addEventListener("keydown", handleKeyDown as EventListener);

    return () => {
      container.removeEventListener("click", handleClick as EventListener);
      container.removeEventListener("keydown", handleKeyDown as EventListener);
    };
  }, [contentRef, router]);
}
