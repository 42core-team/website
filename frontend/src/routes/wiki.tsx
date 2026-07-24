import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router'
import { loadWikiRouteData, WikiPageRoute } from './wiki.$'

export const Route = createFileRoute('/wiki')({
  loader: ({ location }) => loadWikiRouteData(location.pathname),
  component: WikiIndexRoute,
})

function WikiIndexRoute() {
  const data = Route.useLoaderData()
  const pathname = useLocation({ select: (location) => location.pathname })

  if (pathname !== '/wiki' && pathname !== '/wiki/') {
    return <Outlet />
  }

  return <WikiPageRoute data={data} />
}
