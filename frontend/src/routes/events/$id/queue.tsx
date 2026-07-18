import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { LogIn, LogOut, Swords, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  getQueueMatches,
  getQueueState,
  joinQueue,
  leaveQueue,
} from '@/app/actions/team'
import { MatchState } from '@/app/actions/tournament-model'
import { myTeamQueryFn, myTeamQueryKey } from '@/app/events/my-team-queries'
import QueueMatchesList from '@/components/QueueMatchesList'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/events/$id/queue')({
  component: QueueRoute,
})

function QueueRoute() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeQueueMatchId, setActiveQueueMatchId] = useState<string | null>(
    null,
  )
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

  const joinQueueMutation = useMutation({
    mutationFn: async () => joinQueue(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['event', id, 'queue-state'],
      })
    },
  })

  const leaveQueueMutation = useMutation({
    mutationFn: async () => leaveQueue(id),
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['event', id, 'queue-state'],
      })
    },
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
  const inQueue = queueState?.inQueue ?? false
  const canLeaveQueue = inQueue && !isQueueMatchRunning
  const queueStatus = isQueueMatchRunning
    ? 'Match Running'
    : inQueue
      ? 'In Queue'
      : 'Idle'

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      {isQueueMatchRunning && (
        <Card className="mb-6">
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
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <Swords className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">{myTeamQuery.data.name}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
              disabled={joinQueueMutation.isPending}
              onClick={() => joinQueueMutation.mutate()}
            >
              <LogIn className="size-4" />
              Join Queue
            </Button>
          )}
        </CardContent>
      </Card>
      <div className="mt-6">
        <QueueMatchesList eventId={id} matches={queueMatchesQuery.data ?? []} />
      </div>
    </main>
  )
}
