import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { getQueueMatchesAdmin } from '@/app/actions/team'
import QueueMatchesList from '@/components/QueueMatchesList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/events/$id/queue-matches')({
  component: QueueMatchesRoute,
})

function QueueMatchesRoute() {
  const { id } = Route.useParams()
  const matchesQuery = useQuery({
    queryKey: ['event', id, 'queue-matches-admin'],
    queryFn: () => getQueueMatchesAdmin(id),
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
        <CardHeader>
          <CardTitle>Queue Matches</CardTitle>
        </CardHeader>
        <CardContent>
          <QueueMatchesList eventId={id} matches={matchesQuery.data ?? []} />
        </CardContent>
      </Card>
    </main>
  )
}
