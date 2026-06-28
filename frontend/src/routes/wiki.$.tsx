import { createFileRoute, useLocation } from "@tanstack/react-router";
import { WikiLayout } from "@/components/wiki/WikiLayout";
import {
  getAvailableVersions,
  getDefaultWikiVersion,
  getWikiNavigationWithVersion,
  getWikiPageWithVersion,
} from "@/lib/markdown";

interface WikiRouteData {
  defaultVersion: string;
  version: string;
  pagePath: string[];
  page: Awaited<ReturnType<typeof getWikiPageWithVersion>>;
  navigation: Awaited<ReturnType<typeof getWikiNavigationWithVersion>>;
  versions: Awaited<ReturnType<typeof getAvailableVersions>>;
  fallbackMessage?: string;
}

export const Route = createFileRoute("/wiki/$")({
  loader: async ({ location }): Promise<WikiRouteData> => {
    const versions = await getAvailableVersions();
    const defaultVersion = await getDefaultWikiVersion();
    const slug = location.pathname
      .replace(/^\/wiki\/?/, "")
      .split("/")
      .filter(Boolean);

    const possibleVersion = slug[0] ?? defaultVersion;
    const isVersion = versions.some(v => v.slug === possibleVersion);
    const version = isVersion ? possibleVersion : defaultVersion;
    let pagePath = isVersion ? slug.slice(1) : slug;

    if (pagePath.length === 0) {
      pagePath = ["README"];
    }

    const [navigation, page] = await Promise.all([
      getWikiNavigationWithVersion(version),
      getWikiPageWithVersion(pagePath, version),
    ]);

    if (page) {
      return {
        defaultVersion,
        version,
        pagePath,
        page,
        navigation,
        versions,
      };
    }

    const homePage = await getWikiPageWithVersion([], version);

    return {
      defaultVersion,
      version,
      pagePath: [],
      page: homePage,
      navigation,
      versions,
      fallbackMessage: `The page ${pagePath.join("/")} is not available in ${
        version === defaultVersion ? "the default version" : version
      }. Showing the home page for this version instead.`,
    };
  },
  component: WikiPageRoute,
});

function WikiPageRoute() {
  const { pathname } = useLocation();
  const {
    defaultVersion,
    version,
    pagePath,
    page,
    navigation,
    versions,
    fallbackMessage,
  } = Route.useLoaderData();

  if (!page) {
    return (
      <WikiLayout
        navigation={navigation}
        currentSlug={pagePath}
        versions={versions}
        currentVersion={version}
      >
        <article className="prose prose-lg max-w-none dark:prose-invert">
          <header className="mb-8">
            <h1 className="mb-2 text-4xl font-bold text-foreground">
              Page Not Found
            </h1>
          </header>
          <p className="text-muted-foreground">
            No wiki page exists for <code>{pathname}</code>.
          </p>
        </article>
      </WikiLayout>
    );
  }

  return (
    <WikiLayout
      navigation={navigation}
      currentSlug={pagePath}
      versions={versions}
      currentVersion={version}
      pageContent={page.content}
    >
      <article className="prose prose-lg max-w-none dark:prose-invert">
        {fallbackMessage && (
          <div className="mb-6 rounded-lg border border-warning-200 bg-warning-50 p-4">
            <h3 className="mb-2 font-semibold text-warning-800">
              Content Not Available
            </h3>
            <p className="text-warning-700">{fallbackMessage}</p>
          </div>
        )}

        <header className="mb-8">
          <h1 className="mb-2 text-4xl font-bold text-foreground">
            {page.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              Last updated:
              {" "}
              {page.lastModified.toLocaleDateString()}
            </span>
            {version !== defaultVersion && (
              <span className="rounded bg-primary-100 px-2 py-1 text-xs font-medium text-primary-700">
                {version}
              </span>
            )}
          </div>
        </header>

        <div
          className="wiki-content"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      </article>
    </WikiLayout>
  );
}
