import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router'
import { canUserCreateEvent, getEvents, getMyEvents } from '@/app/actions/event'
import EventsTabs from '@/app/events/EventsTabs'
import Link from '@/components/app-link'
import { title } from '@/components/primitives'
import { Spinner } from '@/components/ui/8bit/spinner'
import { useSession } from '@/lib/auth'

export const Route = createFileRoute('/events')({
  component: EventsRoute,
})

function EventsRoute() {
  const isEventsIndex = useLocation({
    select: (location) =>
      location.pathname === '/events' || location.pathname === '/events/',
  })
  const { data: session } = useSession()
  const eventsQuery = useQuery({
    queryKey: ['events', 'all'],
    queryFn: getEvents,
  })
  const myEventsQuery = useQuery({
    queryKey: ['events', 'my'],
    queryFn: getMyEvents,
    enabled: Boolean(session?.user.id),
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

  const myEvents = myEventsQuery.data ?? []

  return (
    <main className="container mx-auto h-screen px-4 py-8">
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
        <EventsTabs
          myEvents={myEvents}
          allEvents={eventsQuery.data}
          isLoggedIn={Boolean(session?.user.id)}
        />
      </div>
    </main>
  )
}
