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
import GithubLoginButton from '@/components/github'
import EventInfoNotice from '@/components/event-info-notice'
import EventNavbar from '@/components/event-navbar'
import { MarkdownContent } from '@/components/MarkdownContent'
import RepositoryLockdownNotice from '@/components/repository-lockdown-notice'
import TimeBadge from '@/components/timeBadge'
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
  const eventShell = (children: ReactNode) => (
    <div className="relative flex min-h-lvh flex-col">
      {userId && (
        <EventInfoNotice
          userId={userId}
          startDate={event.startDate}
          eventId={id}
          isPrivate={event.isPrivate}
          isUserRegistered={isUserRegistered}
        />
      )}
      <EventNavbar
        event={event}
        eventId={id}
        isUserRegistered={isUserRegistered}
        hasTeam={Boolean(myTeamQuery.data)}
        isEventAdmin={isEventAdminQuery.data ?? false}
      />
      <RepositoryLockdownNotice
        repoLockDate={event.repoLockDate}
        lockedAt={event.lockedAt}
      />
      {children}
    </div>
  )

  if (!isEventOverview) {
    return eventShell(<Outlet />)
  }

  return eventShell(
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">{event.name}</h1>

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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Start Date
              </h3>
              <TimeBadge className="mt-1" time={event.startDate} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                End Date
              </h3>
              <TimeBadge className="mt-1" time={event.endDate} />
            </div>
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
