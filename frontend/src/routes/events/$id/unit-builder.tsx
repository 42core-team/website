import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { getEventById } from '@/app/actions/event'
import UnitBuilder from '@/components/unit-builder/UnitBuilder'
import { readComponentsConfig } from '@/components/unit-builder/config'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/events/$id/unit-builder')({
  component: UnitBuilderRoute,
})

function UnitBuilderRoute() {
  const { id } = Route.useParams()

  // Open to everyone at all times, whether or not they joined the event.
  const eventQuery = useQuery({
    queryKey: ['event', id],
    queryFn: () => getEventById(id),
  })

  if (eventQuery.isPending) {
    return (
      <main className="page-frame page-state">
        <Spinner />
      </main>
    )
  }

  if (eventQuery.isError) {
    return <Navigate to="/events/$id" params={{ id }} replace />
  }

  const config = readComponentsConfig(eventQuery.data.gameConfig)

  if (!config) {
    return (
      <main className="page-frame page-workspace space-y-6 py-8">
        <h1 className="page-title">Unit Builder</h1>
        <Alert>
          <AlertTitle>Unit builder not used</AlertTitle>
          <AlertDescription>
            This event does not use the unit builder.
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  return (
    <main className="page-frame page-workspace py-8">
      <UnitBuilder config={config} />
    </main>
  )
}
