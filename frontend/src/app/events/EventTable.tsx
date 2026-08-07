'use client'

import * as React from 'react'

import type { Event } from '@/app/actions/event'
import { getEventStatus } from '@/app/events/events-view'
import { useRouter } from '@/lib/router-hooks'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const EVENTS_PER_PAGE = 15

interface EventsTableProps {
  events: Event[]
  joinedEventIds?: ReadonlySet<string>
  now?: number
}

function EventStatusBadge({ event, now }: { event: Event; now: number }) {
  const status = getEventStatus(event, now)
  const presentation = {
    upcoming: { text: 'Upcoming', variant: 'secondary' as const },
    live: { text: 'Live', variant: 'default' as const },
    completed: { text: 'Completed', variant: 'outline' as const },
  }[status]

  return <Badge variant={presentation.variant}>{presentation.text}</Badge>
}

function JoinedBadge({ isJoined }: { isJoined: boolean }) {
  return isJoined ? <Badge variant="secondary">Joined</Badge> : null
}

export default function EventsTable({
  events,
  joinedEventIds = new Set(),
  now = Date.now(),
}: Readonly<EventsTableProps>) {
  const router = useRouter()
  const [page, setPage] = React.useState(1)
  const totalPages = Math.max(1, Math.ceil(events.length / EVENTS_PER_PAGE))
  const paginatedEvents = React.useMemo(() => {
    const start = (page - 1) * EVENTS_PER_PAGE

    return events.slice(start, start + EVENTS_PER_PAGE)
  }, [events, page])

  React.useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages))
  }, [totalPages])

  const openEvent = (eventId: string) => {
    router.push(`/events/${eventId}`)
  }

  return (
    <div className="mb-8">
      <div className="space-y-3 md:hidden">
        {paginatedEvents.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No events found
            </CardContent>
          </Card>
        ) : (
          paginatedEvents.map((event) => (
            <Card
              key={event.id}
              role="link"
              tabIndex={0}
              aria-label={`Open ${event.name}`}
              className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={() => openEvent(event.id)}
              onKeyDown={(keyboardEvent) => {
                if (keyboardEvent.key === 'Enter') {
                  openEvent(event.id)
                }
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-lg">{event.name}</CardTitle>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <EventStatusBadge event={event} now={now} />
                    <JoinedBadge isJoined={joinedEventIds.has(event.id)} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Start date</p>
                  <p className="mt-1 font-medium">
                    {new Date(event.startDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Team size</p>
                  <p className="mt-1 font-medium">
                    {event.minTeamSize}–{event.maxTeamSize} members
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead>Team Size</TableHead>
            <TableHead>State</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-center text-muted-foreground"
              >
                No events found
              </TableCell>
            </TableRow>
          ) : (
            paginatedEvents.map((event) => (
              <TableRow
                key={event.id}
                role="link"
                tabIndex={0}
                aria-label={`Open ${event.name}`}
                className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                onClick={() => openEvent(event.id)}
                onKeyDown={(keyboardEvent) => {
                  if (keyboardEvent.key === 'Enter') {
                    openEvent(event.id)
                  }
                }}
              >
                <TableCell className="font-medium">
                  <div className="flex flex-wrap items-center gap-2">
                    {event.name}
                    <JoinedBadge isJoined={joinedEventIds.has(event.id)} />
                  </div>
                </TableCell>
                <TableCell>
                  {new Date(event.startDate).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {event.minTeamSize} - {event.maxTeamSize} members
                </TableCell>
                <TableCell>
                  <EventStatusBadge event={event} now={now} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {events.length > EVENTS_PER_PAGE && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((currentPage) => currentPage - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((currentPage) => currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
