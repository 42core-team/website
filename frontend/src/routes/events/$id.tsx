import { useQuery } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import { MapPin, UserRound, Users, UsersRound } from 'lucide-react'
import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import {
  getEventById,
  getParticipantsCountForEvent,
  getTeamsCountForEvent,
  isEventAdmin,
  isUserRegisteredForEvent,
} from '@/app/actions/event'
import { myTeamQueryFn, myTeamQueryKey } from '@/app/events/my-team-queries'
import GithubLoginButton from '@/components/github'
import EventHeader from '@/components/event-status/event-header'
import EventMomentCard from '@/components/event-status/event-moment-card'
import EventTimelineCard from '@/components/event-status/event-timeline-card'
import { formatEventTime } from '@/components/event-status/shared'
import { MarkdownContent } from '@/components/MarkdownContent'
import { eventMoment } from '@/lib/event-moment'
import { eventTabs } from '@/lib/event-tabs'
import { useEventClock } from '@/hooks/use-event-clock'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useSession } from '@/lib/auth'

export const Route = createFileRoute('/events/$id')({
  component: EventRoute,
})

function EventFact({
  icon: Icon,
  label,
  value,
}: Readonly<{ icon: LucideIcon; label: string; value: ReactNode }>) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}

function EventRoute() {
  const now = useEventClock()
  const { id } = Route.useParams()
  const isEventOverview = useLocation({
    select: (location) =>
      location.pathname === `/events/${id}` ||
      location.pathname === `/events/${id}/`,
  })
  const { data: session, status } = useSession()
  const userId = session?.user.id

  const eventQuery = useQuery({
    queryKey: ['event', id],
    queryFn: async () => getEventById(id),
    refetchInterval: 1000,
    enabled: Boolean(userId),
  })

  const teamsCountQuery = useQuery({
    queryKey: ['event', id, 'teams-count'],
    queryFn: () => getTeamsCountForEvent(id),
    enabled: Boolean(userId) && eventQuery.isSuccess,
  })

  const participantsCountQuery = useQuery({
    queryKey: ['event', id, 'participants-count'],
    queryFn: () => getParticipantsCountForEvent(id),
    enabled: Boolean(userId) && eventQuery.isSuccess,
  })

  const isUserRegisteredQuery = useQuery({
    queryKey: ['event', id, 'is-user-registered'],
    queryFn: async () => isUserRegisteredForEvent(id),
    enabled: Boolean(userId),
  })

  const isEventAdminQuery = useQuery({
    queryKey: ['event', id, 'is-event-admin'],
    queryFn: async () => isEventAdmin(id),
    enabled: Boolean(userId),
  })

  const myTeamQuery = useQuery({
    queryKey: myTeamQueryKey(id),
    queryFn: () => myTeamQueryFn(id),
    enabled: Boolean(userId) && Boolean(isUserRegisteredQuery.data),
    // Poll quickly only while GitHub is still applying a repository change.
    refetchInterval: (query) =>
      ['PROVISIONING', 'LOCKING', 'UNLOCKING'].includes(
        query.state.data?.repositoryStatus ?? '',
      )
        ? 3000
        : 30_000,
  })

  if (status === 'loading' || (userId && eventQuery.isPending)) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </main>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <main className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication required</CardTitle>
            <CardDescription>
              Please log in with GitHub to view this event.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GithubLoginButton />
          </CardContent>
        </Card>
      </main>
    )
  }

  if (eventQuery.isError) {
    return (
      <main className="container mx-auto px-4 py-16">
        <p className="text-center text-destructive">No event data found.</p>
      </main>
    )
  }

  if (!eventQuery.data) {
    return null
  }

  const event = eventQuery.data
  const isUserRegistered = isUserRegisteredQuery.data ?? false
  const myTeam = myTeamQuery.data ?? null
  const viewerKnown =
    isUserRegisteredQuery.isSuccess &&
    (!isUserRegistered || myTeamQuery.isSuccess)
  const moment = eventMoment(
    event,
    viewerKnown ? { isRegistered: isUserRegistered, team: myTeam } : null,
    { now },
  )
  const tabs = eventTabs({
    event,
    now,
    isRegistered: isUserRegistered,
    team: myTeam,
    viewerKnown,
    isAdmin: isEventAdminQuery.data ?? false,
    formatTime: (iso) => formatEventTime(iso, now),
  })
  const eventShell = (children: ReactNode) => (
    <div className="relative flex min-h-lvh flex-col">
      <EventHeader
        eventName={event.name}
        moment={moment}
        tabs={tabs}
        now={now}
      />
      {children}
    </div>
  )

  if (!isEventOverview) {
    return eventShell(<Outlet />)
  }

  return eventShell(
    <main className="container mx-auto max-w-7xl px-4 py-8">
      {/* The event name is shown in the event header. */}
      <h1 className="sr-only">{event.name}</h1>

      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <EventMomentCard event={event} moment={moment} now={now} />
          </div>
          <dl className="divide-y rounded-xl border bg-card p-6">
            <EventFact
              icon={UserRound}
              label="Participants"
              value={participantsCountQuery.data ?? '-'}
            />
            <EventFact
              icon={Users}
              label="Teams"
              value={teamsCountQuery.data ?? '-'}
            />
            <EventFact
              icon={UsersRound}
              label="Team size"
              value={`${event.minTeamSize}–${event.maxTeamSize} members`}
            />
            <EventFact
              icon={MapPin}
              label="Location"
              value={event.location || 'TBA'}
            />
          </dl>
        </div>

        {event.description && (
          <section
            aria-labelledby="event-about-heading"
            className="rounded-xl border bg-card p-6 sm:p-8"
          >
            <h2
              id="event-about-heading"
              className="mb-3 text-sm font-medium tracking-wider text-muted-foreground uppercase"
            >
              About this event
            </h2>
            {/* The first paragraph reads as the event's lead. */}
            <MarkdownContent
              className="text-foreground [&>p:first-child]:text-lg [&>p:first-child]:leading-relaxed"
              content={event.description}
            />
          </section>
        )}

        <EventTimelineCard event={event} moment={moment} />
      </div>
    </main>,
  )
}
