import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { LogIn, LogOut, Swords, Users } from 'lucide-react'
import { isActionError } from '@/app/actions/errors'
import {
  getQueueMatches,
  getQueueState,
  joinQueue,
  leaveQueue,
} from '@/app/actions/team'
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
  const queryClient = useQueryClient()
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

  const joinQueueMutation = useMutation({
    mutationFn: async () => {
      const result = await joinQueue(id)
      if (isActionError(result)) throw new Error(result.error)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['event', id, 'queue-state'],
      })
    },
  })

  const leaveQueueMutation = useMutation({
    mutationFn: async () => {
      const result = await leaveQueue(id)
      if (isActionError(result)) throw new Error(result.error)
    },
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

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <Swords className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">{myTeamQuery.data.name}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant={inQueue ? 'default' : 'secondary'}>
                  {inQueue ? 'In Queue' : 'Idle'}
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
          {inQueue ? (
            <Button
              variant="destructive"
              disabled={leaveQueueMutation.isPending}
              onClick={() => leaveQueueMutation.mutate()}
            >
              <LogOut className="size-4" />
              Leave Queue
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
