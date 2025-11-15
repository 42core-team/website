import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getWikiPageWithVersion,
  getWikiNavigationWithVersion,
  getAvailableVersions,
  getDefaultWikiVersion,
} from "@/lib/markdown";
import { WikiLayout } from "@/components/wiki/WikiLayout";

interface WikiPageProps {
  params: Promise<{ slug?: string[] }>;
}

async function parseSlugForVersion(slug: string[]) {
  const versions = await getAvailableVersions();
  const defaultVersion = await getDefaultWikiVersion();

  if (slug.length === 0) {
    return { version: defaultVersion, pagePath: [] };
  }

  const possibleVersion = slug[0];
  const isVersion = versions.some((v) => v.slug === possibleVersion);

  if (isVersion) {
    return {
      version: possibleVersion,
      pagePath: slug.slice(1),
    };
  }

  // If user explicitly requests a version that doesn't exist, 404
  if (slug.length > 0) {
    notFound();
  }

  return {
    version: defaultVersion,
    pagePath: slug,
  };
}

export async function generateMetadata({
  params,
}: WikiPageProps): Promise<Metadata> {
  const { slug = [] } = await params;
  const { version, pagePath } = await parseSlugForVersion(slug);
  const page = await getWikiPageWithVersion(pagePath, version);

  if (!page) {
    return {
      title: "Page Not Found | CORE Wiki",
    };
  }

  const versionSuffix = version !== "latest" ? ` (${version})` : "";
  const url = `/wiki/${version}/${pagePath.join("/")}`;
  const plainText = page.content.replace(/<[^>]+>/g, "").slice(0, 160);
  const description = plainText || `Documentation for ${page.title}`;
  return {
    title: `${page.title}${versionSuffix} | CORE Wiki`,
    description,
    openGraph: {
      title: `${page.title}${versionSuffix} | CORE Wiki`,
      description,
      url,
      type: "article",
    },
    twitter: {
      card: "summary",
      title: `${page.title}${versionSuffix} | CORE Wiki`,
      description,
    },
    alternates: {
      canonical: url,
    },
  };
}

export async function generateStaticParams() {
  const versions = await getAvailableVersions();
  const params: { slug: string[] }[] = [];

  for (const version of versions) {
    const nav = await getWikiNavigationWithVersion(version.slug);
    const traverse = (items: any[], prefix: string[] = []) => {
      for (const item of items) {
        if (item.isFile) {
          params.push({ slug: [version.slug, ...item.slug] });
        }
        if (item.children) {
          traverse(item.children, item.slug);
        }
      }
    };
    traverse(nav);
    // also push version root
    params.push({ slug: [version.slug] });
  }

  return params;
}

export default async function WikiPage({ params }: WikiPageProps) {
  const { slug = [] } = await params;
  let { version, pagePath } = await parseSlugForVersion(slug);

  if (pagePath.length === 0) {
    pagePath = ["README"];
  }

  let page: any = null;
  let isImageError = false;

  try {
    page = await getWikiPageWithVersion(pagePath, version);
  } catch (error: any) {
    // Check if this is an image file error
    if (error.message && error.message.includes("Cannot load image file")) {
      isImageError = true;
    } else {
      throw error; // Re-throw other errors
    }
  }

  const [navigation, versions] = await Promise.all([
    getWikiNavigationWithVersion(version),
    getAvailableVersions(),
  ]);

  // Get the default version for comparison
  const defaultVersion = await getDefaultWikiVersion();

  // If this is an image file error, redirect to parent directory
  if (isImageError && pagePath.length > 0) {
    const parentPath = pagePath.slice(0, -1);
    try {
      const parentPage = await getWikiPageWithVersion(parentPath, version);
      if (parentPage) {
        return (
          <WikiLayout
            navigation={navigation}
            currentSlug={parentPath}
            versions={versions}
            currentVersion={version}
            pageContent={parentPage.content}
          >
            <article className="prose prose-lg dark:prose-invert max-w-none">
              <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mb-6">
                <h3 className="text-warning-800 font-semibold mb-2">
                  Image File Accessed
                </h3>
                <p className="text-warning-700">
                  You tried to access an image file{" "}
                  <code>{pagePath[pagePath.length - 1]}</code> as a page.
                  Showing the parent page instead.
                </p>
              </div>

              <header className="mb-8">
                <h1 className="text-4xl font-bold text-foreground mb-2">
                  {parentPage.title}
                </h1>
                <div className="text-sm text-muted-foreground flex items-center gap-4">
                  <span>
                    Last updated: {parentPage.lastModified.toLocaleDateString()}
                  </span>
                  {version !== defaultVersion && (
                    <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded text-xs font-medium">
                      {version}
                    </span>
                  )}
                </div>
              </header>

              <div
                className="wiki-content"
                dangerouslySetInnerHTML={{ __html: parentPage.content }}
              />
            </article>
          </WikiLayout>
        );
      }
    } catch {
      // If parent page doesn't exist, fall through to notFound
    }
  }

  // If page doesn't exist and we have a specific path, try to fallback
  if (!page && pagePath.length > 0) {
    // Try to get the version home page instead
    const homePage = await getWikiPageWithVersion([], version);
    if (homePage) {
      return (
        <WikiLayout
          navigation={navigation}
          currentSlug={[]}
          versions={versions}
          currentVersion={version}
          pageContent={homePage.content}
        >
          <article className="prose prose-lg dark:prose-invert max-w-none">
            <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mb-6">
              <h3 className="text-warning-800 font-semibold mb-2">
                Content Not Available
              </h3>
              <p className="text-warning-700">
                The page <code>{pagePath.join("/")}</code> is not available in{" "}
                {version === defaultVersion ? "the default version" : version}.
                Showing the home page for this version instead.
              </p>
            </div>

            <header className="mb-8">
              <h1 className="text-4xl font-bold text-foreground mb-2">
                {homePage.title}
              </h1>
              <div className="text-sm text-muted-foreground flex items-center gap-4">
                <span>
                  Last updated: {homePage.lastModified.toLocaleDateString()}
                </span>
                {version !== defaultVersion && (
                  <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded text-xs font-medium">
                    {version}
                  </span>
                )}
              </div>
            </header>

            <div
              className="wiki-content"
              dangerouslySetInnerHTML={{ __html: homePage.content }}
            />
          </article>
        </WikiLayout>
      );
    }
  }

  if (!page) {
    notFound();
  }

  return (
    <WikiLayout
      navigation={navigation}
      currentSlug={pagePath}
      versions={versions}
      currentVersion={version}
      pageContent={page.content}
    >
      <article className="prose prose-lg dark:prose-invert max-w-none">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            {page.title}
          </h1>
          <div className="text-sm text-muted-foreground flex items-center gap-4">
            <span>Last updated: {page.lastModified.toLocaleDateString()}</span>
            {version !== defaultVersion && (
              <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded text-xs font-medium">
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
