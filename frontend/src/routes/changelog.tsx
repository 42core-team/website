import { createFileRoute } from "@tanstack/react-router";
import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import Link from "@/components/app-link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPaginatedReleases } from "@/lib/changelog";

const PAGE_SIZE = 42;

export const Route = createFileRoute("/changelog")({
  validateSearch: (search: Record<string, unknown>) => ({
    page:
      typeof search.page === "string"
        ? Number.parseInt(search.page, 10) || 1
        : 1,
  }),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ deps }) => {
    const page = Math.max(1, deps.page);
    const paginated = getPaginatedReleases(page, PAGE_SIZE);
    const renderedBodies = await Promise.all(
      paginated.releases.map(release => markdownToHtml(release.body)),
    );

    return { ...paginated, renderedBodies };
  },
  component: ChangelogPage,
});

async function markdownToHtml(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(md || "");
  return String(file);
}

function bumpLevel(curr: string, prev?: string): 1 | 2 | 3 | 4 {
  if (!prev)
    return 4;
  const toNums = (tag: string) =>
    tag
      .replace(/^v/i, "")
      .split(".")
      .map(num => Number.parseInt(num, 10) || 0);
  const current = toNums(curr);
  const previous = toNums(prev);
  for (let i = 0; i < 4; i++) {
    if ((current[i] ?? 0) !== (previous[i] ?? 0))
      return (i + 1) as 1 | 2 | 3 | 4;
  }
  return 4;
}

function ChangelogPage() {
  const { releases, total, totalPages, page, perPage, renderedBodies } =
    Route.useLoaderData();

  return (
    <main className="container mx-auto px-4 py-10">
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
                    {globalIndex === 0 && (
                      <Badge variant="secondary" className="ml-2">
                        latest
                      </Badge>
                    )}
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
                      View on GitHub -&gt;
                    </Link>
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <nav className="mt-8 flex items-center justify-between">
        {page <= 1
          ? (
              <Button variant="outline" disabled>
                &lt;- Newer
              </Button>
            )
          : (
              <Button asChild variant="outline">
                <Link href={`/changelog?page=${Math.max(1, page - 1)}`}>
                  &lt;- Newer
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
                Older -&gt;
              </Button>
            )
          : (
              <Button asChild variant="outline">
                <Link href={`/changelog?page=${Math.min(totalPages, page + 1)}`}>
                  Older -&gt;
                </Link>
              </Button>
            )}
      </nav>
    </main>
  );
}
