import type { Metadata } from "next";
import Link from "next/link";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPaginatedReleases } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Look at the latest features added to CORE Game.",
  openGraph: {
    title: "Changelog",
    description: "Look at the latest features added to CORE Game.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Changelog",
    description: "Look at the latest features added to CORE Game.",
  },
};

async function markdownToHtml(md: string): Promise<string> {
  const file = await remark()
    .use(remarkGfm)
    .use(remarkHtml)
    .process(md || "");
  return String(file);
}

// determines which version number was incremented in a release (e.g. v1.2.3.4 -> v1.3.0.0 is a level 2 bump).
function bumpLevel(curr: string, prev?: string): 1 | 2 | 3 | 4 {
  if (!prev)
    return 4;
  const toNums = (t: string) =>
    t
      .replace(/^v/i, "")
      .split(".")
      .map(n => Number.parseInt(n, 10) || 0);
  const c = toNums(curr);
  const p = toNums(prev);
  for (let i = 0; i < 4; i++) {
    if ((c[i] ?? 0) !== (p[i] ?? 0))
      return (i + 1) as 1 | 2 | 3 | 4;
  }
  return 4;
}

export const dynamic = "force-dynamic";

interface SearchProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const PAGE_SIZE = 42;

export default async function ChangelogPage({ searchParams }: SearchProps) {
  const sp = (await searchParams) || {};
  const pageParam = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number.parseInt(pageParam || "1", 10) || 1);

  const { releases, total, totalPages, perPage } = getPaginatedReleases(
    page,
    PAGE_SIZE,
  );

  const renderedBodies = await Promise.all(
    releases.map(r => markdownToHtml(r.body)),
  );

  return (
    <div className="py-10">
      <header className="mb-4">
        <h1 className="pb-2 text-4xl font-bold">Changelog</h1>
        <p className="text-muted-foreground">
          All changes from
          {" "}
          <a
            href="https://github.com/42core-team/monorepo/releases"
            className="underline hover:no-underline"
            target="_blank"
            rel="noreferrer"
          >
            42core-team/monorepo
          </a>
          .
          {" "}
          {total}
          {" "}
          release
          {total === 1 ? "" : "s"}
          {" "}
          total.
        </p>
      </header>

      <Accordion
        type="multiple"
        className="rounded-md border bg-card text-card-foreground"
        {...(page === 1 && releases[0]
          ? { defaultValue: [String(releases[0].id)] }
          : {})}
      >
        {releases.map((rel, idx) => {
          const html = renderedBodies[idx];
          const date = new Date(rel.published_at);

          const globalIndex = (page - 1) * perPage + idx;
          const prevTag = releases[idx + 1]?.tag_name;
          const level = bumpLevel(rel.tag_name, prevTag);

          const sizeClass
            = level === 1
              ? "text-4xl"
              : level === 2
                ? "text-3xl"
                : level === 3
                  ? "text-xl"
                  : "text-base";

          const weightClass
            = level === 1
              ? "font-black"
              : level === 2
                ? "font-extrabold"
                : level === 3
                  ? "font-bold"
                  : "font-medium";

          const latestBadge
            = globalIndex === 0
              ? (
                  <Badge variant="secondary" className="ml-2">
                    latest
                  </Badge>
                )
              : null;

          return (
            <AccordionItem key={rel.id} value={String(rel.id)}>
              <AccordionTrigger className="px-4">
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`${sizeClass} ${weightClass}`}>
                      {rel.name}
                    </span>
                    <span className="text-muted-foreground">
                      (
                      {rel.tag_name}
                      )
                    </span>
                    {latestBadge}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {date.toLocaleDateString()}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                {html.trim()
                  ? (
                      <article
                        className="prose max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: html }}
                      />
                    )
                  : (
                      <p className="text-muted-foreground italic">
                        No description.
                      </p>
                    )}

                <div className="mt-4">
                  <Button asChild variant="link">
                    <Link href={rel.html_url} target="_blank" rel="noreferrer">
                      View on GitHub →
                    </Link>
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Pagination */}
      <nav className="mt-8 flex items-center justify-between">
        {page <= 1
          ? (
              <Button variant="outline" disabled>
                ← Newer
              </Button>
            )
          : (
              <Button asChild variant="outline">
                <Link href={`/changelog?page=${Math.max(1, page - 1)}`}>
                  ← Newer
                </Link>
              </Button>
            )}

        <span className="text-sm text-muted-foreground">
          Page
          {" "}
          {page}
          {" "}
          /
          {" "}
          {totalPages}
          {" "}
          &middot;
          {" "}
          {perPage}
          {" "}
          per page
        </span>

        {page >= totalPages
          ? (
              <Button variant="outline" disabled>
                Older →
              </Button>
            )
          : (
              <Button asChild variant="outline">
                <Link href={`/changelog?page=${Math.min(totalPages, page + 1)}`}>
                  Older →
                </Link>
              </Button>
            )}
      </nav>
    </div>
  );
}
