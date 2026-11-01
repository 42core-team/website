import { MatchTeamHeader } from '@/components/match/MatchTeamHeader'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { ExternalLink } from 'lucide-react'
import { getEventById, isEventAdmin } from '@/app/actions/event'
import {
  getLogsOfMatch,
  getMatchById,
  getTournamentTeamCount,
} from '@/app/actions/tournament'
import { MatchPhase } from '@/app/actions/tournament-model'
import MatchLogsDisplay from '@/components/match/MatchLogsDisplay'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { getS3ReplaysBucketUrl, getVisualizerUrl } from '@/lib/env'
import { buildMatchVisualizerUrl } from '@/lib/visualizer-url'

export const Route = createFileRoute('/events/$id/match/$matchId')({
  component: MatchRoute,
})

function getTotalRounds(teamCount: number) {
  if (teamCount <= 1) return 1
  return Math.ceil(Math.log2(teamCount))
}

function MatchRoute() {
  const { id, matchId } = Route.useParams()
  const eventAdminQuery = useQuery({
    queryKey: ['event', id, 'is-event-admin'],
    queryFn: () => isEventAdmin(id),
  })
  // Unrevealed tournament matches only exist for event admins; the header
  // still waits for the reveal before it shows the result.
  const adminReveal = eventAdminQuery.data === true
  const matchQuery = useQuery({
    queryKey: ['match', matchId, { adminReveal }],
    queryFn: async () => getMatchById(matchId, adminReveal),
    enabled: !eventAdminQuery.isPending,
  })
  const eventQuery = useQuery({
    queryKey: ['event', id],
    queryFn: async () => getEventById(id),
  })
  const isEliminationMatch = matchQuery.data?.phase === MatchPhase.ELIMINATION
  const teamCountQuery = useQuery({
    queryKey: ['event', id, 'tournament-team-count'],
    queryFn: () => getTournamentTeamCount(id),
    enabled: isEliminationMatch,
  })
  const maxRounds =
    isEliminationMatch && typeof teamCountQuery.data === 'number'
      ? getTotalRounds(teamCountQuery.data)
      : undefined
  const visualizerUrl = buildMatchVisualizerUrl({
    visualizerUrl: getVisualizerUrl(),
    replaysBucketUrl: getS3ReplaysBucketUrl(),
    matchId,
    visualizerDockerImage: eventQuery.data?.visualizerDockerImage,
    phase: matchQuery.data?.phase,
    round: matchQuery.data?.round,
    maxRounds,
    isPlacementMatch: matchQuery.data?.isPlacementMatch,
  })
  const logsQuery = useQuery({
    queryKey: ['match', matchId, 'logs'],
    queryFn: async () => getLogsOfMatch(matchId),
    enabled: Boolean(matchQuery.data),
    // Logs are only visible to event admins and the match's teams; the
    // section stays hidden for everyone else.
    retry: (failureCount, error) =>
      !(isAxiosError(error) && error.response?.status === 403) &&
      failureCount < 3,
  })

  if (
    matchQuery.isPending ||
    (isEliminationMatch && teamCountQuery.isPending)
  ) {
    return (
      <main className="flex min-h-[45vh] items-center justify-center">
        <Spinner />
      </main>
    )
  }

  if (matchQuery.isError || (isEliminationMatch && teamCountQuery.isError)) {
    return (
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <p className="text-center text-destructive">Match not found.</p>
      </main>
    )
  }

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Match</h1>
        {visualizerUrl && (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
          >
            <a href={visualizerUrl} target="_blank" rel="noreferrer">
              <ExternalLink />
              Open visualizer
            </a>
          </Button>
        )}
      </div>
      <div className="space-y-6">
        <MatchTeamHeader match={matchQuery.data} eventId={id} />
        {visualizerUrl && (
          <div className="aspect-video overflow-hidden rounded-md border bg-black">
            <iframe
              src={visualizerUrl}
              title="Match visualizer"
              className="h-full w-full"
              allowFullScreen
            />
          </div>
        )}
        {logsQuery.data && <MatchLogsDisplay logs={logsQuery.data} />}
      </div>
    </main>
  )
}
