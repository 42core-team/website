import { createFileRoute } from '@tanstack/react-router'
import { MyTeamPage } from '@/app/events/MyTeamPage'

export const Route = createFileRoute('/events/$id/my-team')({
  component: MyTeamRoute,
})

function MyTeamRoute() {
  const { id } = Route.useParams()
  return <MyTeamPage eventId={id} />
}
