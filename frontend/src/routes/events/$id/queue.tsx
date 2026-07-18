import type { Team } from '@/app/actions/team'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { AxiosError } from 'axios'
import { Coins, LogIn, Search, Swords } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  getQueueMatches,
  getQueueState,
  getTeamsForEventTable,
  joinQueue,
  startDirectMatch,
} from '@/app/actions/team'
import { MatchState } from '@/app/actions/tournament-model'
import { myTeamQueryFn, myTeamQueryKey } from '@/app/events/my-team-queries'
import QueueMatchesList from '@/components/QueueMatchesList'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/events/$id/queue')({
  component: QueueRoute,
})

function getErrorMessage(error: Error) {
  const axiosError = error as AxiosError<{ message?: string }>
  return axiosError.response?.data.message ?? error.message
}

function QueueRoute() {
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
  const [isOpponentDialogOpen, setIsOpponentDialogOpen] = useState(false)
  const [opponentSearch, setOpponentSearch] = useState('')
  const myTeamQuery = useQuery({
    queryKey: myTeamQueryKey(id),
    queryFn: () => myTeamQueryFn(id),
  })
  const queueStateQuery = useQuery({
    queryKey: ['event', id, 'queue-state'],
    queryFn: () => getQueueState(id),
    refetchInterval: 2000,
    enabled: Boolean(myTeamQuery.data),
  })
  const queueMatchesQuery = useQuery({
    queryKey: ['event', id, 'queue-matches'],
    queryFn: () => getQueueMatches(id),
    refetchInterval: 2000,
    enabled: Boolean(myTeamQuery.data),
  })
  const opponentsQuery = useQuery({
    queryKey: ['event', id, 'teams', 'queue-opponents'],
    queryFn: () => getTeamsForEventTable(id),
    enabled: Boolean(myTeamQuery.data) && isOpponentDialogOpen,
  })
  const refreshQueueData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['event', id, 'queue-state'],
      }),
      queryClient.invalidateQueries({
        queryKey: ['event', id, 'queue-matches'],
      }),
      queryClient.invalidateQueries({ queryKey: myTeamQueryKey(id) }),
    ])
  }

  const joinQueueMutation = useMutation({
    mutationFn: async () => joinQueue(id),
    onSuccess: async () => {
      await refreshQueueData()
      toast.success('Opponent found. Your match is starting.')
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })

  const directMatchMutation = useMutation({
    mutationFn: (targetTeamId: string) => startDirectMatch(id, targetTeamId),
    onSuccess: async () => {
      setIsOpponentDialogOpen(false)
      setOpponentSearch('')
      await refreshQueueData()
      toast.success(
        'Direct match is starting. You paid 1 credit and staked 1 credit.',
      )
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })

  if (myTeamQuery.isPending) {
    return (
      <main className="flex min-h-[45vh] items-center justify-center">
        <Spinner />
      </main>
    )
  }

  if (!myTeamQuery.data) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>No team found</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            Create or join a team before entering the queue.
          </CardContent>
        </Card>
      </main>
    )
  }

  const queueState = queueStateQuery.data
  const credits = queueState?.credits ?? myTeamQuery.data.credits
  const canJoinQueue = credits >= 1
  const canStartDirectMatch = credits >= 2
  const queueMatches = queueMatchesQuery.data ?? []
  const activeQueueMatches = queueMatches.filter(
    (match) => match.state === MatchState.IN_PROGRESS,
  )
  const finishedQueueMatches = queueMatches.filter(
    (match) => match.state === MatchState.FINISHED,
  )
  const normalizedOpponentSearch = opponentSearch.trim().toLocaleLowerCase()
  const opponents = (opponentsQuery.data ?? []).filter(
    (team: Team) =>
      team.id !== myTeamQuery.data?.id &&
      team.name.toLocaleLowerCase().includes(normalizedOpponentSearch),
  )

  return (
    <main className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Card>
        <CardContent className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                <Swords className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold">{myTeamQuery.data.name}</p>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">Ready</Badge>
                  {activeQueueMatches.length > 0 && (
                    <Badge>
                      {activeQueueMatches.length} event{' '}
                      {activeQueueMatches.length === 1 ? 'match' : 'matches'}{' '}
                      playing
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button
              disabled={!canJoinQueue || joinQueueMutation.isPending}
              onClick={() => joinQueueMutation.mutate()}
            >
              {joinQueueMutation.isPending ? (
                <>
                  <Spinner />
                  Finding opponent
                </>
              ) : (
                <>
                  <LogIn className="size-4" />
                  Join Queue · 1 credit
                </>
              )}
            </Button>
          </div>

          <div className="border-t pt-5">
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Coins className="size-5 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Queue credits</p>
                <p className="text-xl font-semibold">{credits}</p>
                <p className="text-xs text-muted-foreground">
                  Earns 1 credit every 15 minutes
                  {queueState?.nextCreditAt
                    ? ` · next at ${new Date(
                        queueState.nextCreditAt,
                      ).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                    : ''}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Dialog
          open={isOpponentDialogOpen}
          onOpenChange={(open) => {
            setIsOpponentDialogOpen(open)
            if (!open) setOpponentSearch('')
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline">
              <Swords className="size-4" />
              Choose opponent
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Choose an opponent</DialogTitle>
              <DialogDescription>
                A direct match requires 2 credits: 1 is always paid and 1 is
                staked. Win to get the staked credit back; lose and both credits
                are spent.
              </DialogDescription>
            </DialogHeader>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={opponentSearch}
                onChange={(event) => setOpponentSearch(event.target.value)}
                placeholder="Search teams by name..."
                className="pl-9"
                aria-label="Search teams by name"
              />
            </div>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {opponentsQuery.isPending ? (
                <div className="flex justify-center py-10">
                  <Spinner />
                </div>
              ) : opponents.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {normalizedOpponentSearch
                    ? 'No teams match your search.'
                    : 'No other teams are available in this event yet.'}
                </p>
              ) : (
                opponents.map((opponent: Team) => (
                  <div
                    key={opponent.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{opponent.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Queue score {opponent.queueScore}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={
                        !canStartDirectMatch || directMatchMutation.isPending
                      }
                      onClick={() => directMatchMutation.mutate(opponent.id)}
                    >
                      <Swords className="size-4" />
                      Play · 2 credits
                    </Button>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {activeQueueMatches.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Currently playing</h2>
          <QueueMatchesList eventId={id} matches={activeQueueMatches} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Your match history</h2>
        <QueueMatchesList eventId={id} matches={finishedQueueMatches} />
      </section>
    </main>
  )
}
