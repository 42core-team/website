import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
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
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Spinner,
} from '@/components/ui/themed'

export const Route = createFileRoute('/events/$id/gambling')({
  component: GamblingRoute,
})

const GAMBLING_QUERY_INTERVAL_MS = 3000

function GamblingRoute() {
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
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
            isBetPending={betMutation.isPending}
            onPlaceBet={(teamId, credits) =>
              betMutation.mutate({ teamId, credits })
            }
          />
          <GamblingLatestResult eventId={id} result={snapshot.latestResult} />
        </div>

        <GamblingSidebar
          entries={snapshot.entries}
          myTeam={snapshot.myTeam}
          isMembershipPending={
            joinMutation.isPending || leaveMutation.isPending
          }
          onToggleMembership={(isEntered) =>
            isEntered ? leaveMutation.mutate() : joinMutation.mutate()
          }
        />
      </div>
    </main>
  )
}
