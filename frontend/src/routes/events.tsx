import { PageHeader, PageLayout } from '@/layouts/page-layout'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router'
import { getEvents, getEventsOverview } from '@/app/actions/event'
import EventsView from '@/app/events/EventsView'
import Link from '@/components/app-link'
import { Button } from '@/components/ui/button'
import { PageError } from '@/components/ui/page-error'
import { PageLoader } from '@/components/ui/page-loader'
import { useSession } from '@/lib/auth'
import { EVENTS_LIST_REFETCH_INTERVAL_MS } from '@/lib/query-intervals'

export const Route = createFileRoute('/events')({
  component: EventsRoute,
})

function EventsRoute() {
  const isEventsIndex = useLocation({
    select: (location) =>
      location.pathname === '/events' || location.pathname === '/events/',
  })
  const { data: session, status } = useSession()
  const isLoggedIn = Boolean(session?.user.id)
  const eventsQuery = useQuery({
    queryKey: ['events', isLoggedIn ? 'overview' : 'all'],
    queryFn: async () => {
      if (isLoggedIn) {
        return getEventsOverview()
      }

      return { allEvents: await getEvents(), myEvents: [] }
    },
    enabled: status !== 'loading',
    refetchInterval: isEventsIndex ? EVENTS_LIST_REFETCH_INTERVAL_MS : false,
  })

  if (!isEventsIndex) {
    return <Outlet />
  }

  if (eventsQuery.isPending) {
    return <PageLoader />
  }

  if (eventsQuery.isError) {
    return (
      <PageError
        title="Events"
        description="Failed to load events."
        action={
          <Button variant="outline" onClick={() => void eventsQuery.refetch()}>
            Try again
          </Button>
        }
      />
    )
  }

  return (
    <PageLayout>
      <PageHeader
        title="Events"
        description="Discover and join upcoming coding competitions"
        actions={
          session?.user.abilities.createEvent && (
            <Button asChild>
              <Link href="/events/create">Create event</Link>
            </Button>
          )
        }
      />
      <EventsView
        myEvents={eventsQuery.data.myEvents}
        allEvents={eventsQuery.data.allEvents}
        isLoggedIn={isLoggedIn}
      />
    </PageLayout>
  )
}
