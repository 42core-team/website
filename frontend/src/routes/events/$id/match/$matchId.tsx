import { PageLayout } from '@/layouts/page-layout'
import { MatchTeamHeader } from '@/components/match/MatchTeamHeader'
import { MatchVisualizerFrame } from '@/components/match/MatchVisualizerFrame'
import { ScrollToLogsButton } from '@/components/match/ScrollToLogsButton'
import { useQuery } from '@tanstack/react-query'
import {
  createFileRoute,
  useCanGoBack,
  useRouter,
} from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { useRef } from 'react'
import { getEventById } from '@/app/actions/event'
import {
  getLogsOfMatch,
  getMatchById,
  getTournamentTeamCount,
} from '@/app/actions/tournament'
import { MatchPhase } from '@/app/actions/tournament-model'
import MatchLogsDisplay from '@/components/match/MatchLogsDisplay'
import { PageError } from '@/components/ui/page-error'
import { PageLoader } from '@/components/ui/page-loader'
import { useHideSiteNav } from '@/contexts/NavbarContext'
import { useEventAbilities } from '@/hooks/use-event-abilities'
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
  const logsRef = useRef<HTMLDivElement>(null)
  const { abilities, isPending: abilitiesPending } = useEventAbilities(id)
  // Unrevealed tournament matches only exist for event staff; the header
  // still waits for the reveal before it shows the result.
  const adminReveal = abilities.viewUnrevealedResults
  const matchQuery = useQuery({
    queryKey: ['match', matchId, { adminReveal }],
    queryFn: async () => getMatchById(matchId, adminReveal),
    enabled: !abilitiesPending,
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
  const hasLogs = logsQuery.data?.some((log) => log.logs.length > 0)
  const isLoading =
    matchQuery.isPending || (isEliminationMatch && teamCountQuery.isPending)
  const isError =
    matchQuery.isError || (isEliminationMatch && teamCountQuery.isError)
  // Only the loaded page has its own header to navigate with.
  useHideSiteNav(!isLoading && !isError)

  if (isLoading) {
    return <PageLoader />
  }

  if (isError) {
    return <PageError title="Match" description="Match not found." />
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
          visualizerUrl && hasLogs && <ScrollToLogsButton logsRef={logsRef} />
        }
      />
      <PageLayout frame="full" className="max-sm:scroll-mt-0">
        <h1 className="sr-only">Match</h1>
        {visualizerUrl && (
          // The visualizer sizes its board from its height alone. Fill the
          // viewport below the navbar, but stay short
          // enough on narrow screens that the board, 79px shorter than the
          // iframe, still fits.
          <div className="h-[min(calc(100dvh-var(--navbar-height)),calc(100vw+4rem))] overflow-hidden bg-black">
            <MatchVisualizerFrame src={visualizerUrl} />
          </div>
        )}
        {logsQuery.data && (
          <div
            ref={logsRef}
            tabIndex={-1}
            // Clears the navbar, which is only sticky from sm up.
            className="page-frame page-content outline-none focus-visible:ring-1 focus-visible:ring-ring sm:scroll-mt-(--navbar-height)"
          >
            <MatchLogsDisplay logs={logsQuery.data} />
          </div>
        )}
      </PageLayout>
    </>
  )
}
