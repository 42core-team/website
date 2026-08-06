import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router'
import {
  canUserCreateEvent,
  getEvents,
  getEventsOverview,
} from '@/app/actions/event'
import EventsView from '@/app/events/EventsView'
import Link from '@/components/app-link'
import { title } from '@/components/primitives'
import { Spinner } from '@/components/ui/spinner'
import { useSession } from '@/lib/auth'

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
  })
  const canCreateQuery = useQuery({
    queryKey: ['events', 'can-create'],
    queryFn: canUserCreateEvent,
    enabled: Boolean(session?.user.id),
  })

  if (!isEventsIndex) {
    return <Outlet />
  }

  if (eventsQuery.isPending) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </main>
    )
  }

  if (eventsQuery.isError) {
    return (
      <main className="container mx-auto px-4 py-16">
        <p className="text-center text-destructive">Failed to load events.</p>
      </main>
    )
  }

  return (
    <main className="container mx-auto min-h-screen px-4 py-8">
      <div className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div className="flex flex-row items-center justify-center">
          <h1 className={title()}>Events</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Discover and join upcoming coding competitions
        </p>
        {canCreateQuery.data && (
          <Link className="text-primary underline" href="/events/create">
            Create Event
          </Link>
        )}
      </div>
      <div className="mt-8">
        <EventsView
          myEvents={eventsQuery.data.myEvents}
          allEvents={eventsQuery.data.allEvents}
          isLoggedIn={isLoggedIn}
        />
      </div>
    </main>
  )
}
