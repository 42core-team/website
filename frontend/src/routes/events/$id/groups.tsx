import { PageHeader, PageLayout } from '@/layouts/page-layout'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { getTeamsForEventTable } from '@/app/actions/team'
import {
  getSwissMatches,
  getTournamentTeamCount,
} from '@/app/actions/tournament'
import { AdminRevealSwitch } from '@/components/tournament/admin-reveal-switch'
import { GroupPhaseTabs } from '@/components/tournament/tournament-tabs'
import { PageError } from '@/components/ui/page-error'
import { PageLoader } from '@/components/ui/page-loader'
import { useEventAbilities } from '@/hooks/use-event-abilities'
import { useSearchParams } from '@/lib/router-hooks'

export const Route = createFileRoute('/events/$id/groups')({
  component: GroupsRoute,
})

function GroupsRoute() {
  const { id } = Route.useParams()
  const searchParams = useSearchParams()
  const isAdminReveal = searchParams.get('adminReveal') === 'true'

  const matchesQuery = useQuery({
    queryKey: ['event', id, 'swiss-matches', { adminReveal: isAdminReveal }],
    queryFn: () => getSwissMatches(id, isAdminReveal),
  })

  const { abilities, isPending: abilitiesPending } = useEventAbilities(id)

  const teamsQuery = useQuery({
    queryKey: [
      'event',
      id,
      'teams',
      {
        sortColumn: 'score',
        sortDirection: 'desc',
        adminReveal: isAdminReveal,
      },
    ],
    queryFn: () =>
      getTeamsForEventTable(id, undefined, 'score', 'desc', isAdminReveal),
  })

  const advancementCountQuery = useQuery({
    queryKey: ['event', id, 'tournament-team-count'],
    queryFn: () => getTournamentTeamCount(id),
  })

  if (
    matchesQuery.isPending ||
    abilitiesPending ||
    teamsQuery.isPending ||
    advancementCountQuery.isPending
  ) {
    return <PageLoader frame="workspace" />
  }

  if (
    matchesQuery.isError ||
    teamsQuery.isError ||
    advancementCountQuery.isError
  ) {
    return (
      <PageError
        title="Group Phase"
        description="Failed to load group phase data."
      />
    )
  }

  return (
    <PageLayout frame="workspace">
      <PageHeader
        title="Group Phase"
        description="In the group phase, teams compete using the Swiss tournament system, with rankings determined by the Buchholz scoring system."
        actions={abilities.viewUnrevealedResults && <AdminRevealSwitch />}
      />
      <GroupPhaseTabs
        eventId={id}
        matches={matchesQuery.data}
        teams={teamsQuery.data}
        canViewUnrevealedResults={abilities.viewUnrevealedResults}
        advancementCount={advancementCountQuery.data}
      />
    </PageLayout>
  )
}
