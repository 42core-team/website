import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import { getLogsOfMatch, getMatchById } from '@/app/actions/tournament'
import MatchLogsDisplay from '@/components/match/MatchLogsDisplay'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { getS3ReplaysBucketUrl, getVisualizerUrl } from '@/lib/env'

export const Route = createFileRoute('/events/$id/match/$matchId')({
  component: MatchRoute,
})

function MatchRoute() {
  const { matchId } = Route.useParams()
  const matchQuery = useQuery({
    queryKey: ['match', matchId],
    queryFn: async () => getMatchById(matchId),
  })
  const visualizerUrl = matchQuery.data
    ? getMatchVisualizerUrl(
        matchId,
        matchQuery.data.phase,
        matchQuery.data.round,
      )
    : getMatchVisualizerUrl(matchId)
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            Match
            <Badge>{matchQuery.data.state}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <div className="grid gap-4 md:grid-cols-2">
            {matchQuery.data.teams.map((team) => (
              <div key={team.id} className="rounded-md border p-4">
                <p className="font-semibold">{team.name}</p>
                <p className="text-sm text-muted-foreground">
                  Score: {team.score}
                </p>
              </div>
            ))}
          </div>
          {logsQuery.data && <MatchLogsDisplay logs={logsQuery.data} />}
        </CardContent>
      </Card>
    </main>
  )
}

function getMatchVisualizerUrl(
  matchId: string,
  phase?: string,
  round?: number,
) {
  const visualizerUrl = getVisualizerUrl()
  const replaysBucketUrl = getS3ReplaysBucketUrl()

  if (!visualizerUrl || !replaysBucketUrl) return null

  const url = new URL(visualizerUrl)
  url.searchParams.set('replays', `${replaysBucketUrl}/${matchId}/replay.json`)
  url.searchParams.set('dynamicSpeed', 'on')
  url.searchParams.set('autoplay', 'start')
  if (phase) url.searchParams.set('mode', phase)
  if (typeof round === 'number') url.searchParams.set('round', String(round))

  return url.toString()
}
