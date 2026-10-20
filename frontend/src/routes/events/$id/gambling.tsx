import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { getEventById } from '@/app/actions/event'
import { bettingOpen } from '@/lib/event-lifecycle'
import { getMyEventTeam } from '@/app/actions/team'
import { useEventClock } from '@/hooks/use-event-clock'
import {
  getGamblingSnapshot,
  joinGamblingList,
  leaveGamblingList,
  placeGamblingBet,
} from '@/app/actions/gambling'
import {
  GamblingHeader,
  GamblingLatestResult,
  GamblingMatchCard,
  GamblingSidebar,
  getGamblingErrorMessage,
} from '@/components/gambling'
import { Lock } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/events/$id/gambling')({
  component: GamblingRoute,
})

const GAMBLING_QUERY_INTERVAL_MS = 3000

function GamblingRoute() {
  const now = useEventClock()
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
  const eventQuery = useQuery({
    queryKey: ['event', id],
    queryFn: () => getEventById(id),
    refetchInterval: 1000,
  })
  const teamQuery = useQuery({
    queryKey: ['event', id, 'gambling-team'],
    queryFn: () => getMyEventTeam(id),
    refetchInterval: 3000,
  })
  const canBet = Boolean(
    eventQuery.data &&
    bettingOpen(eventQuery.data, now) &&
    teamQuery.data?.repositoryStatus === 'READY' &&
    !teamQuery.data.tournamentExcluded,
  )
  const queryKey = ['event', id, 'gambling'] as const
  const gamblingQuery = useQuery({
    queryKey,
    queryFn: () => getGamblingSnapshot(id),
    refetchInterval: GAMBLING_QUERY_INTERVAL_MS,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey })

  const joinMutation = useMutation({
    mutationFn: () => joinGamblingList(id),
    onSuccess: async () => {
      await refresh()
      toast.success('Your team joined the gambling list.')
    },
    onError: (error: Error) => toast.error(getGamblingErrorMessage(error)),
  })
  const leaveMutation = useMutation({
    mutationFn: () => leaveGamblingList(id),
    onSuccess: async () => {
      await refresh()
      toast.success('Your team left the gambling list.')
    },
    onError: (error: Error) => toast.error(getGamblingErrorMessage(error)),
  })
  const betMutation = useMutation({
    mutationFn: ({ teamId, credits }: { teamId: string; credits: number }) =>
      placeGamblingBet(id, teamId, credits),
    onSuccess: async () => {
      await refresh()
      toast.success('Bet placed. Good luck!')
    },
    onError: (error: Error) => toast.error(getGamblingErrorMessage(error)),
  })

  if (gamblingQuery.isPending) {
    return (
      <main className="flex min-h-[45vh] items-center justify-center">
        <Spinner size="lg" />
      </main>
    )
  }

  if (gamblingQuery.isError) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <Alert variant="destructive">
          <AlertTitle>Gambling could not be loaded</AlertTitle>
          <AlertDescription>
            {getGamblingErrorMessage(gamblingQuery.error)}
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  const snapshot = gamblingQuery.data

  return (
    <main className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      {!canBet && (
        <Alert role="status">
          <Lock className="size-4" aria-hidden="true" />
          <AlertTitle>Betting closed</AlertTitle>
          <AlertDescription>
            Existing bets and results remain available.
          </AlertDescription>
        </Alert>
      )}
      <GamblingHeader
        round={snapshot.round}
        onCountdownComplete={() => {
          void gamblingQuery.refetch()
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="space-y-6">
          <GamblingMatchCard
            eventId={id}
            snapshot={snapshot}
            bettingEnabled={canBet}
            isBetPending={betMutation.isPending}
            onPlaceBet={(teamId, credits) =>
              canBet && betMutation.mutate({ teamId, credits })
            }
          />
          <GamblingLatestResult eventId={id} result={snapshot.latestResult} />
        </div>

        <GamblingSidebar
          membershipEnabled={canBet}
          entries={snapshot.entries}
          myTeam={snapshot.myTeam}
          isMembershipPending={
            joinMutation.isPending || leaveMutation.isPending
          }
          onToggleMembership={(isEntered) =>
            canBet &&
            (isEntered ? leaveMutation.mutate() : joinMutation.mutate())
          }
        />
      </div>
    </main>
  )
}
