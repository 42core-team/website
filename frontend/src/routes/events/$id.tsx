import { useQuery } from '@tanstack/react-query'
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
import { getTournamentMatches } from '@/app/actions/tournament'
import GithubLoginButton from '@/components/github'
import EventHeader from '@/components/event-status/event-header'
import EventTimelineCard from '@/components/event-status/event-timeline-card'
import { formatEventTime } from '@/components/event-status/shared'
import { MarkdownContent } from '@/components/MarkdownContent'
import { readComponentsConfig } from '@/components/unit-builder/config'
import { eventState } from '@/lib/event-lifecycle'
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

function StatCard({ title, value }: { title: string; value: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="mb-2 text-lg font-semibold">{title}</CardTitle>
        <CardDescription className="text-3xl font-bold">
          {value}
        </CardDescription>
      </CardHeader>
    </Card>
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

  const isShowtime =
    eventQuery.data !== undefined &&
    eventState(eventQuery.data, now) === 'SHOWCASE'
  // Elimination matches exist once the tournament tree has started.
  const tournamentMatchesQuery = useQuery({
    queryKey: ['event', id, 'tournament-matches', { adminReveal: false }],
    queryFn: () => getTournamentMatches(id, false),
    enabled: isShowtime,
    refetchInterval: 30_000,
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
    {
      now,
      tournamentStage: tournamentMatchesQuery.data?.length
        ? 'bracket'
        : 'groups',
    },
  )
  const tabs = eventTabs({
    event,
    now,
    isRegistered: isUserRegistered,
    hasTeam: Boolean(myTeam),
    isAdmin: isEventAdminQuery.data ?? false,
    supportsUnitBuilder: readComponentsConfig(event.gameConfig) !== null,
    formatTime: (iso) => formatEventTime(iso, now),
  })
  const eventShell = (children: ReactNode) => (
    <div className="relative flex min-h-lvh flex-col">
      <EventHeader eventId={id} moment={moment} tabs={tabs} now={now} />
      {children}
    </div>
  )

  if (!isEventOverview) {
    return eventShell(<Outlet />)
  }

  return eventShell(
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">{event.name}</h1>

      <div className="mb-8">
        <EventTimelineCard event={event} moment={moment} now={now} />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Participants"
          value={participantsCountQuery.data ?? '-'}
        />
        <StatCard title="Teams" value={teamsCountQuery.data ?? '-'} />
        <StatCard title="Location" value={event.location || 'TBA'} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Event Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">
              Description
            </h3>
            {event.description ? (
              <MarkdownContent
                className="mt-1 text-foreground"
                content={event.description}
              />
            ) : (
              <p className="mt-1 text-muted-foreground">
                No description provided.
              </p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-muted-foreground">
              Team Size
            </h3>
            <p className="mt-1">
              {event.minTeamSize}
              {' - '}
              {event.maxTeamSize}
              {' members'}
            </p>
          </div>
        </CardContent>
      </Card>
    </main>,
  )
}
