"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
}

export function TableOfContents({ content }: TableOfContentsProps) {
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    // Parse headings from HTML content
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");
    const headings = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");

    const tocItems: TocItem[] = Array.from(headings)
      .map((heading) => ({
        id: heading.id,
        text: heading.textContent || "",
        level: parseInt(heading.tagName.charAt(1)),
      }))
      .filter((item) => item.id && item.text);

    setToc(tocItems);
  }, [content]);

  useEffect(() => {
    // Track which heading is currently visible
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0% -35% 0%" },
    );

    toc.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [toc]);

  if (toc.length === 0) {
    return null;
  }

  return (
    <nav className="sticky top-24 h-fit">
      <div className="border border-divider rounded-lg p-4 bg-content1">
        <h3 className="text-sm font-semibold text-default-700 mb-3">
          On this page
        </h3>
        <ul className="space-y-1">
          {toc.map((item) => (
            <li key={item.id}>
              <Link
                href={`#${item.id}`}
                className={`block text-sm hover:text-primary transition-colors ${
                  activeId === item.id
                    ? "text-primary font-medium"
                    : "text-default-600"
                }`}
                style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
              >
                {item.text}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
