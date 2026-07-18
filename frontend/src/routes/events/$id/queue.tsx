import type { Team } from '@/app/actions/team'
import type { TeamChallenge } from '@/app/actions/team.model'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import type { AxiosError } from 'axios'
import {
  Check,
  Coins,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  Send,
  Swords,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  acceptTeamChallenge,
  challengeTeam,
  declineTeamChallenge,
  getPendingTeamChallenges,
  getQueueMatches,
  getQueueState,
  getTeamsForEventTable,
  joinQueue,
  leaveQueue,
  setTeamQueueVisibility,
} from '@/app/actions/team'
import { MatchState } from '@/app/actions/tournament-model'
import { myTeamQueryFn, myTeamQueryKey } from '@/app/events/my-team-queries'
import QueueMatchesList from '@/components/QueueMatchesList'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'

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
  const challengesQuery = useQuery({
    queryKey: ['event', id, 'queue-challenges'],
    queryFn: () => getPendingTeamChallenges(id),
    refetchInterval: 2000,
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

  const refreshQueueData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['event', id, 'queue-state'],
      }),
      queryClient.invalidateQueries({
        queryKey: ['event', id, 'queue-challenges'],
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

  const visibilityMutation = useMutation({
    mutationFn: (isPublic: boolean) => setTeamQueueVisibility(id, isPublic),
    onSuccess: async (_, isPublic) => {
      await Promise.all([
        refreshQueueData(),
        queryClient.invalidateQueries({
          queryKey: ['event', id, 'teams', 'queue-opponents'],
        }),
      ])
      toast.success(
        isPublic
          ? 'Your team is public and will earn one credit every 15 minutes.'
          : 'Your team is private. New challenges now require approval.',
      )
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })

  const challengeMutation = useMutation({
    mutationFn: (targetTeamId: string) => challengeTeam(id, targetTeamId),
    onSuccess: async (challenge) => {
      setIsOpponentDialogOpen(false)
      await refreshQueueData()
      toast.success(
        challenge.matchId
          ? 'Challenge accepted automatically. The match is starting.'
          : 'Challenge request sent.',
      )
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })

  const acceptChallengeMutation = useMutation({
    mutationFn: (challengeId: string) => acceptTeamChallenge(id, challengeId),
    onSuccess: async () => {
      await refreshQueueData()
      toast.success('Challenge accepted. The match is starting.')
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })

  const declineChallengeMutation = useMutation({
    mutationFn: (challengeId: string) => declineTeamChallenge(id, challengeId),
    onSuccess: refreshQueueData,
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
  const isPublic = queueState?.isPublic ?? myTeamQuery.data.isPublic
  const inQueue = queueState?.inQueue ?? false
  const canLeaveQueue = inQueue && !isQueueMatchRunning
  const canStartMatch = credits > 0 && !inQueue && !isQueueMatchRunning
  const queueStatus = isQueueMatchRunning
    ? 'Match Running'
    : inQueue
      ? 'In Queue'
      : 'Idle'
  const opponents = (opponentsQuery.data ?? []).filter(
    (team: Team) => team.id !== myTeamQuery.data?.id,
  )
  const incomingChallenges = (challengesQuery.data ?? []).filter(
    (challenge) => challenge.target.id === myTeamQuery.data?.id,
  )
  const outgoingChallenges = (challengesQuery.data ?? []).filter(
    (challenge) => challenge.challenger.id === myTeamQuery.data?.id,
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
                disabled={!canStartMatch || joinQueueMutation.isPending}
                onClick={() => joinQueueMutation.mutate()}
              >
                <LogIn className="size-4" />
                Join Queue · 1 credit
              </Button>
            )}
          </div>

          <div className="grid gap-4 border-t pt-5 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <Coins className="size-5 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Queue credits</p>
                <p className="text-xl font-semibold">{credits}</p>
              </div>
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border p-4">
              <div className="flex items-center gap-3">
                {isPublic ? (
                  <Eye className="size-5 text-primary" />
                ) : (
                  <EyeOff className="size-5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">
                    {isPublic ? 'Public team' : 'Private team'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isPublic
                      ? `Earns 1 credit every 15 minutes${
                          queueState?.nextCreditAt
                            ? ` · next at ${new Date(
                                queueState.nextCreditAt,
                              ).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}`
                            : ''
                        }`
                      : 'Challenge requests require your approval'}
                  </p>
                </div>
              </div>
              <Switch
                checked={isPublic}
                disabled={visibilityMutation.isPending}
                onCheckedChange={(checked) =>
                  visibilityMutation.mutate(checked)
                }
                aria-label="Make team public"
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {(incomingChallenges.length > 0 || outgoingChallenges.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Challenge requests</CardTitle>
            <CardDescription>
              Private teams choose whether to accept direct matches.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {incomingChallenges.map((challenge) => (
              <IncomingChallenge
                key={challenge.id}
                challenge={challenge}
                isPending={
                  acceptChallengeMutation.isPending ||
                  declineChallengeMutation.isPending
                }
                onAccept={() => acceptChallengeMutation.mutate(challenge.id)}
                onDecline={() => declineChallengeMutation.mutate(challenge.id)}
              />
            ))}
            {outgoingChallenges.map((challenge) => (
              <div
                key={challenge.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">{challenge.target.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Waiting for their response
                  </p>
                </div>
                <Badge variant="secondary">Pending</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Dialog
          open={isOpponentDialogOpen}
          onOpenChange={setIsOpponentDialogOpen}
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
                Public teams start immediately. Private teams receive a request
                to accept or decline. Your credit is spent only when the match
                starts.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {opponentsQuery.isPending ? (
                <div className="flex justify-center py-10">
                  <Spinner />
                </div>
              ) : opponents.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No other teams are available in this event yet.
                </p>
              ) : (
                opponents.map((opponent: Team) => {
                  const hasPendingRequest = outgoingChallenges.some(
                    (challenge) => challenge.target.id === opponent.id,
                  )
                  return (
                    <div
                      key={opponent.id}
                      className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{opponent.name}</p>
                          <Badge variant="outline">
                            {opponent.isPublic ? 'Public' : 'Private'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Queue score {opponent.queueScore}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={opponent.isPublic ? 'default' : 'outline'}
                        disabled={
                          !canStartMatch ||
                          hasPendingRequest ||
                          challengeMutation.isPending
                        }
                        onClick={() => challengeMutation.mutate(opponent.id)}
                      >
                        <Send className="size-4" />
                        {hasPendingRequest
                          ? 'Request pending'
                          : opponent.isPublic
                            ? 'Play · 1 credit'
                            : 'Request match'}
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <QueueMatchesList eventId={id} matches={queueMatchesQuery.data ?? []} />
    </main>
  )
}

function IncomingChallenge({
  challenge,
  isPending,
  onAccept,
  onDecline,
}: {
  challenge: TeamChallenge
  isPending: boolean
  onAccept: () => void
  onDecline: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">{challenge.challenger.name}</p>
        <p className="text-sm text-muted-foreground">
          wants to play against your team
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={isPending} onClick={onAccept}>
          <Check className="size-4" />
          Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={onDecline}
        >
          <X className="size-4" />
          Decline
        </Button>
      </div>
    </div>
  )
}
