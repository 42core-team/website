'use client'

import * as React from 'react'

import type { Event } from '@/app/actions/event'
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

const EVENTS_PER_PAGE = 15

export default function EventsTable({ events }: Readonly<{ events: Event[] }>) {
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

  const formatState = (
    event: Event,
  ): {
    text: string
    variant: 'default' | 'secondary' | 'destructive'
  } => {
    const hasStarted = Date.now() >= new Date(event.startDate).getTime()

    if (!hasStarted) {
      return {
        text: 'Team finding',
        variant: 'default',
      }
    }

    if (event.currentRound === 0) {
      return {
        text: 'In Progress',
        variant: 'secondary',
      }
    }

    return {
      text: 'Completed',
      variant: 'destructive',
    }
  }

  return (
    <div className="mb-8">
      <Table>
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
                className="cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => router.push(`/events/${event.id}`)}
              >
                <TableCell className="font-medium">{event.name}</TableCell>
                <TableCell>
                  {new Date(event.startDate).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {event.minTeamSize} - {event.maxTeamSize} members
                </TableCell>
                <TableCell>
                  <Badge variant={formatState(event).variant}>
                    {formatState(event).text}
                  </Badge>
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
