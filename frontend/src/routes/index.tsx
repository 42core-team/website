import { PageLayout } from '@/layouts/page-layout'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { getCurrentLiveEvent } from '@/app/actions/event'
import HomePageClient from '@/components/HomePageClient'
import { Button } from '@/components/ui/button'
import { PageError } from '@/components/ui/page-error'
import { PageLoader } from '@/components/ui/page-loader'

export const Route = createFileRoute('/')({
  component: HomeRoute,
})

function HomeRoute() {
  const currentEventQuery = useQuery({
    queryKey: ['events', 'current-live'],
    queryFn: getCurrentLiveEvent,
  })

  if (currentEventQuery.isPending) {
    return <PageLoader />
  }

  if (currentEventQuery.isError) {
    return (
      <PageError
        title="CORE Game"
        description="Failed to load the CORE dashboard."
        action={
          <Button
            variant="outline"
            onClick={() => void currentEventQuery.refetch()}
          >
            Try again
          </Button>
        }
      />
    )
  }

  return (
    <PageLayout frame="full">
      <HomePageClient currentLiveEvent={currentEventQuery.data} />
    </PageLayout>
  )
}
