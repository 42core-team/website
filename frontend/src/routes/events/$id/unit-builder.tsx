import { PageHeader, PageLayout } from '@/layouts/page-layout'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { getEventById } from '@/app/actions/event'
import UnitBuilder from '@/components/unit-builder/UnitBuilder'
import { readComponentsConfig } from '@/components/unit-builder/config'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { PageLoader } from '@/components/ui/page-loader'

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
    return <PageLoader frame="workspace" />
  }

  if (eventQuery.isError) {
    return <Navigate to="/events/$id" params={{ id }} replace />
  }

  const config = readComponentsConfig(eventQuery.data.gameConfig)

  if (!config) {
    return (
      <PageLayout frame="workspace">
        <PageHeader title="Unit Builder" />
        <Alert>
          <AlertTitle>Unit builder not used</AlertTitle>
          <AlertDescription>
            This event does not use the unit builder.
          </AlertDescription>
        </Alert>
      </PageLayout>
    )
  }

  return (
    <PageLayout frame="workspace">
      <UnitBuilder config={config} />
    </PageLayout>
  )
}
