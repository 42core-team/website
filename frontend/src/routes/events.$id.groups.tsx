import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { getSwissMatches, startSwissMatches } from '@/app/actions/tournament'
import QueueMatchesList from '@/components/QueueMatchesList'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/events/$id/groups')({
  component: GroupsRoute,
})

function GroupsRoute() {
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
  const matchesQuery = useQuery({
    queryKey: ['event', id, 'swiss-matches'],
    queryFn: () => getSwissMatches(id, false),
  })
  const startMutation = useMutation({
    mutationFn: () => startSwissMatches(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['event', id, 'swiss-matches'],
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
          <CardTitle>Group Phase</CardTitle>
          <Button
            size="sm"
            disabled={startMutation.isPending}
            onClick={() => startMutation.mutate()}
          >
            Start Next Round
          </Button>
        </CardHeader>
        <CardContent>
          <QueueMatchesList eventId={id} matches={matchesQuery.data ?? []} />
        </CardContent>
      </Card>
    </main>
  )
}
