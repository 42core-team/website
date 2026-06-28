import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  getTournamentMatches,
  getTournamentTeamCount,
  startTournamentMatches,
} from '@/app/actions/tournament'
import QueueMatchesList from '@/components/QueueMatchesList'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/events/$id/bracket')({
  component: BracketRoute,
})

function BracketRoute() {
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
  const matchesQuery = useQuery({
    queryKey: ['event', id, 'tournament-matches'],
    queryFn: () => getTournamentMatches(id, false),
  })
  const teamCountQuery = useQuery({
    queryKey: ['event', id, 'tournament-team-count'],
    queryFn: () => getTournamentTeamCount(id),
  })
  const startMutation = useMutation({
    mutationFn: () => startTournamentMatches(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['event', id, 'tournament-matches'],
      })
    },
  })

  if (matchesQuery.isPending) {
    return (
      <main className="flex min-h-[45vh] items-center justify-center">
        <Spinner />
      </main>
    )
  }

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Tournament Tree</CardTitle>
            <CardDescription>
              {teamCountQuery.data ?? 0} tournament teams
            </CardDescription>
          </div>
          <Button
            size="sm"
            disabled={startMutation.isPending}
            onClick={() => startMutation.mutate()}
          >
            Start Tournament
          </Button>
        </CardHeader>
        <CardContent>
          <QueueMatchesList eventId={id} matches={matchesQuery.data ?? []} />
        </CardContent>
      </Card>
    </main>
  )
}
