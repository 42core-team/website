import { getPaginatedReleases } from "@/lib/changelog";
import { Metadata } from "next";
import Link from "next/link";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";

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

// determines which version number was incremented in a release (e.g. v1.2.3.4 -> v1.3.0.0 is a level 2 bump)
function bumpLevel(curr: string, prev?: string): 1 | 2 | 3 | 4 {
  if (!prev) return 4;
  const toNums = (t: string) =>
    t
      .replace(/^v/i, "")
      .split(".")
      .map((n) => parseInt(n, 10) || 0);
  const c = toNums(curr),
    p = toNums(prev);
  for (let i = 0; i < 4; i++)
    if ((c[i] ?? 0) !== (p[i] ?? 0)) return (i + 1) as 1 | 2 | 3 | 4;
  return 4;
}

export const dynamic = "force-dynamic";

type SearchProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const PAGE_SIZE = 42;

export default async function ChangelogPage({ searchParams }: SearchProps) {
  const sp = (await searchParams) || {};
  const pageParam = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);

  const { releases, total, totalPages, perPage } = getPaginatedReleases(
    page,
    PAGE_SIZE,
  );

  const renderedBodies = await Promise.all(
    releases.map((r) => markdownToHtml(r.body)),
  );

  return (
    <div className="py-10">
      <header className="mb-4">
        <h1 className="text-4xl font-bold pb-2">Changelog</h1>
        <p className="text-default-500">
          All changes from{" "}
          <a
            href="https://github.com/42core-team/monorepo/releases"
            className="underline hover:no-underline"
            target="_blank"
            rel="noreferrer"
          >
            42core-team/monorepo
          </a>
          . {total} release{total === 1 ? "" : "s"} total.
        </p>
      </header>

      <ul className="space-y-4">
        {releases.map((rel, idx) => {
          const html = renderedBodies[idx];
          const date = new Date(rel.published_at);

          const globalIndex = (page - 1) * perPage + idx;
          const prevTag = releases[idx + 1]?.tag_name;
          const level = bumpLevel(rel.tag_name, prevTag);

          const sizeClass =
            level === 1
              ? "text-4xl"
              : level === 2
                ? "text-3xl"
                : level === 3
                  ? "text-xl"
                  : "text-base";

          const weightClass =
            level === 1
              ? "font-black"
              : level === 2
                ? "font-extrabold"
                : level === 3
                  ? "font-bold"
                  : "font-medium";

          const latestBadge =
            globalIndex === 0 ? (
              <span className="ml-2 text-xs px-2 py-0.5 rounded bg-primary-100 text-primary-700">
                latest
              </span>
            ) : null;

          return (
            <li key={rel.id} className="border border-default-200 rounded-md">
              <details {...(globalIndex === 0 ? { open: true } : {})}>
                <summary className="cursor-pointer list-none p-4 hover:bg-default-100 rounded-t-md">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`${sizeClass} ${weightClass}`}>
                        {rel.name}
                      </span>
                      <span className="text-default-500">({rel.tag_name})</span>
                      {latestBadge}
                    </div>
                    <div className="text-sm text-default-500">
                      {date.toLocaleDateString()}
                    </div>
                  </div>
                </summary>

                <div className="px-4 pb-4 pt-2">
                  {html.trim() ? (
                    <article
                      className="prose dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  ) : (
                    <p className="text-default-500 italic">No description.</p>
                  )}

                  <div className="mt-4">
                    <Link
                      href={rel.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline hover:no-underline"
                    >
                      View on GitHub →
                    </Link>
                  </div>
                </div>
              </details>
            </li>
          );
        })}
      </ul>

      {/* Pagination */}
      <nav className="mt-8 flex items-center justify-between">
        <Link
          href={`/changelog?page=${Math.max(1, page - 1)}`}
          className={`px-3 py-2 rounded border ${
            page <= 1
              ? "pointer-events-none opacity-50 border-default-200"
              : "border-default-300 hover:bg-default-100"
          }`}
          aria-disabled={page <= 1}
        >
          ← Newer
        </Link>

        <span className="text-sm text-default-500">
          Page {page} / {totalPages} &middot; {perPage} per page
        </span>

        <Link
          href={`/changelog?page=${Math.min(totalPages, page + 1)}`}
          className={`px-3 py-2 rounded border ${
            page >= totalPages
              ? "pointer-events-none opacity-50 border-default-200"
              : "border-default-300 hover:bg-default-100"
          }`}
          aria-disabled={page >= totalPages}
        >
          Older →
        </Link>
      </nav>
    </div>
  );
}
