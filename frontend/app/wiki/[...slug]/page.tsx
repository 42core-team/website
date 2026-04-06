import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { WikiLayout } from "@/components/wiki/WikiLayout";
import {
  buildWikiPath,
  getAvailableVersions,
  getDefaultWikiVersion,
  getWikiDocumentBySlug,
  getWikiNavigationWithVersion,
  listWikiPageSlugsForVersion,
  parseWikiRouteSlug,
} from "@/lib/wiki";

interface WikiPageProps {
  params: Promise<{ slug?: string[] }>;
}

interface ResolvedWikiPage {
  document: NonNullable<Awaited<ReturnType<typeof getWikiDocumentBySlug>>>;
  isFallback: boolean;
  requestedPath: string[];
}

async function resolveWikiPage(
  version: string,
  pagePath: string[],
): Promise<ResolvedWikiPage | null> {
  const document = await getWikiDocumentBySlug(pagePath, version);
  if (document) {
    return {
      document,
      isFallback: false,
      requestedPath: pagePath,
    };
  }

  if (pagePath.length === 0) {
    return null;
  }

  const homeDocument = await getWikiDocumentBySlug([], version);
  if (!homeDocument) {
    return null;
  }

  return {
    document: homeDocument,
    isFallback: true,
    requestedPath: pagePath,
  };
}

export async function generateMetadata({
  params,
}: WikiPageProps): Promise<Metadata> {
  const { slug = [] } = await params;
  const route = await parseWikiRouteSlug(slug);

  if (!route) {
    return {
      title: "Page Not Found | CORE Wiki",
    };
  }

  const resolvedPage = await resolveWikiPage(route.version, route.pagePath);
  if (!resolvedPage) {
    return {
      title: "Page Not Found | CORE Wiki",
    };
  }

  const defaultVersion = await getDefaultWikiVersion();
  const canonicalPath = buildWikiPath(route.version, resolvedPage.document.slug);
  const plainText = resolvedPage.document.html.replace(/<[^>]+>/g, "").slice(0, 160);
  const description = resolvedPage.isFallback
    ? `The page ${route.pagePath.join("/")} is not available in ${route.version}. Showing ${resolvedPage.document.title} instead.`
    : plainText || `Documentation for ${resolvedPage.document.title}`;
  const versionSuffix = route.version !== defaultVersion
    ? ` (${route.version})`
    : "";

  return {
    title: `${resolvedPage.document.title}${versionSuffix} | CORE Wiki`,
    description,
    alternates: resolvedPage.isFallback
      ? undefined
      : {
          canonical: canonicalPath,
        },
    openGraph: {
      title: `${resolvedPage.document.title}${versionSuffix} | CORE Wiki`,
      description,
      type: "article",
      url: resolvedPage.isFallback ? undefined : canonicalPath,
    },
    twitter: {
      card: "summary",
      title: `${resolvedPage.document.title}${versionSuffix} | CORE Wiki`,
      description,
    },
  };
}

export async function generateStaticParams() {
  const versions = await getAvailableVersions();
  const params: { slug: string[] }[] = [];

  for (const version of versions) {
    const pageSlugs = await listWikiPageSlugsForVersion(version.slug);
    for (const pageSlug of pageSlugs) {
      params.push({ slug: [version.slug, ...pageSlug] });
    }
  }

  return params;
}

export default async function WikiPage({ params }: WikiPageProps) {
  const { slug = [] } = await params;
  const route = await parseWikiRouteSlug(slug);

  if (!route) {
    notFound();
  }

  if (route.redirectPath) {
    redirect(route.redirectPath);
  }

  const resolvedPage = await resolveWikiPage(route.version, route.pagePath);
  if (!resolvedPage) {
    notFound();
  }

  const canonicalPath = buildWikiPath(route.version, resolvedPage.document.slug);
  const requestedPath = buildWikiPath(route.version, route.pagePath);
  if (!resolvedPage.isFallback && canonicalPath !== requestedPath) {
    redirect(canonicalPath);
  }

  const [navigation, versions, defaultVersion] = await Promise.all([
    getWikiNavigationWithVersion(route.version),
    getAvailableVersions(),
    getDefaultWikiVersion(),
  ]);

  return (
    <WikiLayout
      navigation={navigation}
      currentSlug={resolvedPage.document.slug}
      versions={versions}
      currentVersion={route.version}
      tableOfContents={resolvedPage.document.tableOfContents}
    >
      <article className="px-1 py-2 sm:px-3 sm:py-4 lg:px-5">
        {resolvedPage.isFallback && (
          <div className="mb-6 rounded-md border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 shadow-sm dark:border-amber-400/30 dark:bg-amber-500/12">
            <div className="mb-1 font-semibold tracking-[0.12em] text-amber-200 uppercase">
              Warning
            </div>
            <div className="text-amber-50/90">
              The page
              {" "}
              <span className="font-semibold text-amber-50">
                {resolvedPage.requestedPath.join("/")}
              </span>
              {" "}
              is not available in
              {" "}
              <span className="font-semibold text-amber-50">
                {route.version}
              </span>
              .
              {" "}
              Showing this version&apos;s home page instead.
            </div>
          </div>
        )}

        <header className="mb-8 border-b border-border/60 pb-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
              {resolvedPage.document.title}
            </h1>
            {route.version !== defaultVersion && (
              <span className="rounded-md border border-border/80 bg-background px-3 py-1 text-sm font-medium text-foreground">
                {route.version}
              </span>
            )}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Last updated
            {" "}
            <span className="font-medium text-foreground">
              {resolvedPage.document.lastModified.toLocaleDateString()}
            </span>
          </p>
        </header>

        <div
          className="wiki-content prose max-w-none prose-zinc dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: resolvedPage.document.html }}
        />
      </article>
    </WikiLayout>
  );
}
