import { PageHeader } from '@/layouts/page-layout'
import { createFileRoute, useLocation } from '@tanstack/react-router'
import { WikiLayout } from '@/components/wiki/WikiLayout'
import {
  getAvailableVersions,
  getDefaultWikiVersion,
  getWikiNavigationWithVersion,
  getWikiPageWithVersion,
} from '@/lib/markdown'

export interface WikiRouteData {
  defaultVersion: string
  version: string
  pagePath: string[]
  page: Awaited<ReturnType<typeof getWikiPageWithVersion>>
  navigation: Awaited<ReturnType<typeof getWikiNavigationWithVersion>>
  versions: Awaited<ReturnType<typeof getAvailableVersions>>
  fallbackMessage?: string
}

export async function loadWikiRouteData(
  pathname: string,
): Promise<WikiRouteData> {
  const versions = await getAvailableVersions()
  const defaultVersion = await getDefaultWikiVersion()
  const slug = pathname
    .replace(/^\/wiki\/?/, '')
    .split('/')
    .filter(Boolean)

  const possibleVersion = slug[0] ?? defaultVersion
  const isVersion = versions.some((v) => v.slug === possibleVersion)
  const version = isVersion ? possibleVersion : defaultVersion
  let pagePath = isVersion ? slug.slice(1) : slug

  if (pagePath.length === 0) {
    pagePath = ['README']
  }

  const [navigation, page] = await Promise.all([
    getWikiNavigationWithVersion(version),
    getWikiPageWithVersion(pagePath, version),
  ])

  if (page) {
    return {
      defaultVersion,
      version,
      pagePath,
      page,
      navigation,
      versions,
    }
  }

  const homePage = await getWikiPageWithVersion([], version)

  return {
    defaultVersion,
    version,
    pagePath: [],
    page: homePage,
    navigation,
    versions,
    fallbackMessage: `The page ${pagePath.join('/')} is not available in ${
      version === defaultVersion ? 'the default version' : version
    }. Showing the home page for this version instead.`,
  }
}

export const Route = createFileRoute('/wiki/$')({
  params: {
    parse: (params) => (params._splat ? params : false),
  },
  loader: ({ location }) => loadWikiRouteData(location.pathname),
  component: WikiSplatRoute,
})

function WikiSplatRoute() {
  const data = Route.useLoaderData()

  return <WikiPageRoute data={data} />
}

export function WikiPageRoute({ data }: { data: WikiRouteData }) {
  const { pathname } = useLocation()
  const {
    defaultVersion,
    version,
    pagePath,
    page,
    navigation,
    versions,
    fallbackMessage,
  } = data

  if (!page) {
    return (
      <WikiLayout
        navigation={navigation}
        currentSlug={pagePath}
        versions={versions}
        currentVersion={version}
      >
        <article className="reading-column space-y-6">
          <PageHeader title="Page Not Found" />
          <p className="text-muted-foreground">
            No wiki page exists for <code>{pathname}</code>.
          </p>
        </article>
      </WikiLayout>
    )
  }

  return (
    <WikiLayout
      navigation={navigation}
      currentSlug={pagePath}
      versions={versions}
      currentVersion={version}
      pageContent={page.content}
    >
      <article className="reading-column space-y-6">
        <PageHeader
          title={page.title}
          description={
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>
                Last updated: {page.lastModified.toLocaleDateString()}
              </span>
              {version !== defaultVersion && (
                <span className="rounded bg-accent px-2 py-1 text-xs font-medium text-accent-foreground">
                  {version}
                </span>
              )}
            </div>
          }
        />
        {fallbackMessage && (
          <div className="rounded-lg border border-warning-border bg-warning-surface p-4 text-warning">
            <h2 className="mb-2 font-semibold">Content Not Available</h2>
            <p>{fallbackMessage}</p>
          </div>
        )}

        <div
          className="wiki-content prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      </article>
    </WikiLayout>
  )
}
