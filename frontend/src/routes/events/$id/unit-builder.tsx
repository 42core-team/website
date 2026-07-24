import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { getEventById, isUserRegisteredForEvent } from '@/app/actions/event'
import UnitBuilder from '@/components/unit-builder/UnitBuilder'
import { readComponentsConfig } from '@/components/unit-builder/config'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/events/$id/unit-builder')({
  component: UnitBuilderRoute,
})

function UnitBuilderRoute() {
  const { id } = Route.useParams()

  const registrationQuery = useQuery({
    queryKey: ['event', id, 'is-user-registered'],
    queryFn: () => isUserRegisteredForEvent(id),
  })

  const eventQuery = useQuery({
    queryKey: ['event', id],
    queryFn: () => getEventById(id),
    enabled: registrationQuery.data === true,
  })

  if (
    registrationQuery.isPending ||
    (registrationQuery.data === true && eventQuery.isPending)
  ) {
    return (
      <main className="flex min-h-[45vh] items-center justify-center">
        <Spinner />
      </main>
    )
  }

  if (
    registrationQuery.isError ||
    eventQuery.isError ||
    !registrationQuery.data ||
    !eventQuery.data ||
    new Date(eventQuery.data.startDate).getTime() > Date.now()
  ) {
    return <Navigate to="/events/$id" params={{ id }} replace />
  }

  const config = readComponentsConfig(eventQuery.data.gameConfig)

  if (!config) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <Alert variant="destructive">
          <AlertTitle>Unit builder unavailable</AlertTitle>
          <AlertDescription>
            This event does not expose a valid component config.
          </AlertDescription>
        </Alert>
      </main>
    )
  }

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <UnitBuilder config={config} />
    </main>
  )
}
