import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import { getEventById } from '@/app/actions/event'
import { getLogsOfMatch, getMatchById } from '@/app/actions/tournament'
import MatchLogsDisplay from '@/components/match/MatchLogsDisplay'
import { Button, Spinner } from '@/components/ui/themed'
import { getS3ReplaysBucketUrl, getVisualizerUrl } from '@/lib/env'
import { buildMatchVisualizerUrl } from '@/lib/visualizer-url'

export const Route = createFileRoute('/events/$id/match/$matchId')({
  component: MatchRoute,
})

function MatchRoute() {
  const { id, matchId } = Route.useParams()
  const matchQuery = useQuery({
    queryKey: ['match', matchId],
    queryFn: async () => getMatchById(matchId),
  })
  const eventQuery = useQuery({
    queryKey: ['event', id],
    queryFn: async () => getEventById(id),
  })
  const visualizerUrl = buildMatchVisualizerUrl({
    visualizerUrl: getVisualizerUrl(),
    replaysBucketUrl: getS3ReplaysBucketUrl(),
    matchId,
    visualizerDockerImage: eventQuery.data?.visualizerDockerImage,
    phase: matchQuery.data?.phase,
    round: matchQuery.data?.round,
  })
  const logsQuery = useQuery({
    queryKey: ['match', matchId, 'logs'],
    queryFn: async () => getLogsOfMatch(matchId),
    enabled: Boolean(matchQuery.data),
  })

  if (matchQuery.isPending) {
    return (
      <main className="flex min-h-[45vh] items-center justify-center">
        <Spinner />
      </main>
    )
  }

  if (matchQuery.isError) {
    return (
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <p className="text-center text-destructive">Match not found.</p>
      </main>
    )
  }

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Match</h1>
      <div className="space-y-6">
        {visualizerUrl && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Button asChild variant="outline" size="sm">
                <a href={visualizerUrl} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  Open
                </a>
              </Button>
            </div>
            <div className="aspect-video overflow-hidden rounded-md border bg-black">
              <iframe
                src={visualizerUrl}
                title="Match visualizer"
                className="h-full w-full"
                allowFullScreen
              />
            </div>
          </section>
        )}
        {logsQuery.data && <MatchLogsDisplay logs={logsQuery.data} />}
      </div>
    </main>
  )
}
