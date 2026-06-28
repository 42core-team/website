import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { getLogsOfMatch, getMatchById } from '@/app/actions/tournament'
import MatchLogsDisplay from '@/components/match/MatchLogsDisplay'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/events/$id/match/$matchId')({
  component: MatchRoute,
})

function MatchRoute() {
  const { matchId } = Route.useParams()
  const matchQuery = useQuery({
    queryKey: ['match', matchId],
    queryFn: async () => getMatchById(matchId),
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            Match
            <Badge>{matchQuery.data.state}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
