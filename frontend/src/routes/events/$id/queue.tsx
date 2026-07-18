import type { Team } from '@/app/actions/team'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import type { AxiosError } from 'axios'
import { Coins, LogIn, LogOut, Search, Swords, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  getQueueMatches,
  getQueueState,
  getTeamsForEventTable,
  joinQueue,
  leaveQueue,
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
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeQueueMatchId, setActiveQueueMatchId] = useState<string | null>(
    null,
  )
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
    enabled: Boolean(myTeamQuery.data),
  })
  const opponentsQuery = useQuery({
    queryKey: ['event', id, 'teams', 'queue-opponents'],
    queryFn: () => getTeamsForEventTable(id),
    enabled: Boolean(myTeamQuery.data) && isOpponentDialogOpen,
  })
  const queueMatch = queueStateQuery.data?.match
  const isQueueMatchRunning = Boolean(
    queueMatch?.id && queueMatch.state !== MatchState.FINISHED,
  )

  useEffect(() => {
    if (isQueueMatchRunning && queueMatch?.id) {
      setActiveQueueMatchId(queueMatch.id)
      return
    }

    if (
      queueMatch?.id &&
      queueMatch.state === MatchState.FINISHED &&
      queueMatch.id === activeQueueMatchId
    ) {
      void navigate({
        to: '/events/$id/match/$matchId',
        params: { id, matchId: queueMatch.id },
        replace: true,
      })
    }
  }, [activeQueueMatchId, id, isQueueMatchRunning, navigate, queueMatch])

  const refreshQueueData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['event', id, 'queue-state'],
      }),
      queryClient.invalidateQueries({ queryKey: myTeamQueryKey(id) }),
    ])
  }

  const joinQueueMutation = useMutation({
    mutationFn: async () => joinQueue(id),
    onSuccess: refreshQueueData,
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })

  const leaveQueueMutation = useMutation({
    mutationFn: async () => leaveQueue(id),
    onSettled: refreshQueueData,
  })

  const directMatchMutation = useMutation({
    mutationFn: (targetTeamId: string) => startDirectMatch(id, targetTeamId),
    onSuccess: async () => {
      setIsOpponentDialogOpen(false)
      setOpponentSearch('')
      await refreshQueueData()
      toast.success('Direct match is starting. Your team staked 2 credits.')
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
  const inQueue = queueState?.inQueue ?? false
  const canLeaveQueue = inQueue && !isQueueMatchRunning
  const canJoinQueue = credits >= 1 && !inQueue && !isQueueMatchRunning
  const canStartDirectMatch = credits >= 2 && !inQueue && !isQueueMatchRunning
  const queueStatus = isQueueMatchRunning
    ? 'Match Running'
    : inQueue
      ? 'In Queue'
      : 'Idle'
  const normalizedOpponentSearch = opponentSearch.trim().toLocaleLowerCase()
  const opponents = (opponentsQuery.data ?? []).filter(
    (team: Team) =>
      team.id !== myTeamQuery.data?.id &&
      team.name.toLocaleLowerCase().includes(normalizedOpponentSearch),
  )

  return (
    <main className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
      {isQueueMatchRunning && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <Spinner />
            <div>
              <p className="font-semibold">Match is running</p>
              <p className="text-sm text-muted-foreground">
                Keep this page open. You will be redirected to the match replay
                when it finishes.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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
                  <Badge
                    variant={
                      inQueue || isQueueMatchRunning ? 'default' : 'secondary'
                    }
                  >
                    {queueStatus}
                  </Badge>
                  {queueState && (
                    <span className="flex items-center gap-1">
                      <Users className="size-3.5" />
                      {queueState.queueCount} waiting
                    </span>
                  )}
                </div>
              </div>
            </div>
            {canLeaveQueue ? (
              <Button
                variant="destructive"
                disabled={leaveQueueMutation.isPending}
                onClick={() => leaveQueueMutation.mutate()}
              >
                <LogOut className="size-4" />
                Leave Queue
              </Button>
            ) : isQueueMatchRunning ? (
              <Button disabled>
                <Spinner />
                Match Running
              </Button>
            ) : (
              <Button
                disabled={!canJoinQueue || joinQueueMutation.isPending}
                onClick={() => joinQueueMutation.mutate()}
              >
                <LogIn className="size-4" />
                Join Queue · 1 credit
              </Button>
            )}
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
                A direct match starts immediately and stakes 2 credits. Win to
                get the 2-credit stake back; lose and the stake is forfeited.
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

      <QueueMatchesList eventId={id} matches={queueMatchesQuery.data ?? []} />
    </main>
  )
}
