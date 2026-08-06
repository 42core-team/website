'use client'

import { ArrowRight, CalendarDays, MapPin } from 'lucide-react'
import type { Event } from '@/app/actions/event'
import EventsTable from '@/app/events/EventTable'
import {
  buildEventsViewModel,
  buildPublicEventsViewModel,
  getEventStatus,
} from '@/app/events/events-view'
import Link from '@/components/app-link'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function formatDateRange(event: Event) {
  return `${dateFormatter.format(new Date(event.startDate))} – ${dateFormatter.format(new Date(event.endDate))}`
}

function FeaturedEvent({
  event,
  now,
  showJoined,
}: {
  event: Event
  now: number
  showJoined: boolean
}) {
  const status = getEventStatus(event, now)
  const presentation = {
    upcoming: {
      eyebrow: 'Coming up',
      label: 'Upcoming',
      variant: 'secondary' as const,
    },
    live: {
      eyebrow: 'Happening now',
      label: 'Live',
      variant: 'default' as const,
    },
    completed: {
      eyebrow: 'Recently active',
      label: 'Completed',
      variant: 'outline' as const,
    },
  }[status]

  return (
    <section aria-labelledby="featured-event-heading" className="mb-10">
      <p className="mb-3 text-sm font-medium tracking-wide text-muted-foreground uppercase">
        {presentation.eyebrow}
      </p>
      <Link
        href={`/events/${event.id}`}
        aria-label={`View details for ${event.name}`}
        className="group block rounded-xl no-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <Card className="overflow-hidden border-primary/30 bg-linear-to-br from-primary/10 via-card to-card shadow-md transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/50 group-hover:shadow-lg">
          <CardHeader className="gap-5 md:flex-row md:items-start md:justify-between md:space-y-0">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={presentation.variant}>
                  {presentation.label}
                </Badge>
                {showJoined && <Badge variant="secondary">Joined</Badge>}
              </div>
              <div>
                <CardTitle
                  id="featured-event-heading"
                  className="text-2xl md:text-3xl"
                >
                  {event.name}
                </CardTitle>
                {event.description && (
                  <CardDescription className="mt-2 line-clamp-2 max-w-3xl text-base">
                    {event.description}
                  </CardDescription>
                )}
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-2 font-medium text-primary transition-colors group-hover:text-primary/80">
              View event details
              <ArrowRight
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-1"
              />
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-6">
            <span className="flex items-center gap-2">
              <CalendarDays aria-hidden="true" />
              {formatDateRange(event)}
            </span>
            <span className="flex items-center gap-2">
              <MapPin aria-hidden="true" />
              {event.location || 'Location TBA'}
            </span>
          </CardContent>
        </Card>
      </Link>
    </section>
  )
}

export default function EventsView({
  myEvents,
  allEvents,
  isLoggedIn,
}: Readonly<{
  myEvents: Event[]
  allEvents: Event[]
  isLoggedIn: boolean
}>) {
  const now = Date.now()

  const { featuredEvent, events, joinedEventIds } = isLoggedIn
    ? buildEventsViewModel(allEvents, myEvents, now)
    : buildPublicEventsViewModel(allEvents, now)

  return (
    <div>
      {featuredEvent && (
        <FeaturedEvent
          event={featuredEvent}
          now={now}
          showJoined={joinedEventIds.has(featuredEvent.id)}
        />
      )}
      <section aria-labelledby="all-events-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="all-events-heading" className="text-2xl font-semibold">
              All events
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Newest events first
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            {events.length} {events.length === 1 ? 'event' : 'events'}
          </span>
        </div>
        <EventsTable
          events={events}
          joinedEventIds={joinedEventIds}
          now={now}
        />
      </section>
    </div>
  )
}
