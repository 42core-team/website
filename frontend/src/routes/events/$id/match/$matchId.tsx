import { MatchTeamHeader } from '@/components/match/MatchTeamHeader'
import { useQuery } from '@tanstack/react-query'
import {
  createFileRoute,
  useCanGoBack,
  useRouter,
} from '@tanstack/react-router'
import { ChevronLeft, ExternalLink } from 'lucide-react'
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
import { useHideSiteNav } from '@/contexts/NavbarContext'
import Navbar from '@/layouts/basic-navbar'
import { getS3ReplaysBucketUrl, getVisualizerUrl } from '@/lib/env'
import { buildMatchVisualizerUrl } from '@/lib/visualizer-url'
import { retryUnlessStatus } from '@/lib/query-retry'

export const Route = createFileRoute('/events/$id/match/$matchId')({
  component: MatchRoute,
})

function getTotalRounds(teamCount: number) {
  if (teamCount <= 1) return 1
  return Math.ceil(Math.log2(teamCount))
}

function MatchRoute() {
  const { id, matchId } = Route.useParams()
  const router = useRouter()
  const canGoBack = useCanGoBack()
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
    // An unknown or hidden match answers 404, which a retry cannot change.
    retry: retryUnlessStatus(404),
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
    // Logs are only visible to event admins and the match's teams; everyone
    // else gets a 404 and the section stays hidden.
    retry: retryUnlessStatus(403, 404),
  })
  const isLoading =
    matchQuery.isPending || (isEliminationMatch && teamCountQuery.isPending)
  const isError =
    matchQuery.isError || (isEliminationMatch && teamCountQuery.isError)
  // Only the loaded page has its own header to navigate with.
  useHideSiteNav(!isLoading && !isError)

  if (isLoading) {
    return (
      <main className="flex min-h-[45vh] items-center justify-center">
        <Spinner />
      </main>
    )
  }

  if (isError) {
    return (
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <p className="text-center text-destructive">Match not found.</p>
      </main>
    )
  }

  return (
    <>
      <Navbar
        // Its rows wrap on narrow screens, too tall to keep over the visualizer.
        className="static sm:sticky"
        leading={
          <button
            type="button"
            // A match opened directly has no page to return to within the site.
            onClick={() =>
              canGoBack
                ? router.history.back()
                : router.navigate({ to: '/events/$id', params: { id } })
            }
            className="ml-3 hidden items-center gap-1 text-sm text-muted-foreground hover:text-foreground xl:flex"
          >
            <ChevronLeft className="size-4 shrink-0" />
            Back
          </button>
        }
        center={<MatchTeamHeader match={matchQuery.data} eventId={id} />}
        actions={
          visualizerUrl && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden text-muted-foreground sm:inline-flex"
            >
              <a
                href={visualizerUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Open visualizer"
              >
                <ExternalLink />
                <span className="hidden xl:inline">Open visualizer</span>
              </a>
            </Button>
          )
        }
      />
      <main>
        <h1 className="sr-only">Match</h1>
        {visualizerUrl && (
          // The visualizer sizes its board from its height alone. Fill the
          // viewport below the navbar (4rem and a 1px border), but stay short
          // enough on narrow screens that the board, 79px shorter than the
          // iframe, still fits.
          <div className="h-[min(calc(100dvh-4rem-1px),calc(100vw+4rem))] overflow-hidden bg-black">
            <iframe
              src={visualizerUrl}
              title="Match visualizer"
              className="h-full w-full"
              allowFullScreen
            />
          </div>
        )}
        {logsQuery.data && (
          <div className="container mx-auto max-w-7xl px-4 py-8">
            <MatchLogsDisplay logs={logsQuery.data} />
          </div>
        )}
      </main>
    </>
  )
}
