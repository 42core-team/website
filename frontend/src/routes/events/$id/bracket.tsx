import { PageHeader, PageLayout } from '@/layouts/page-layout'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { getTeamsForEventTable } from '@/app/actions/team'
import {
  getTournamentMatches,
  getTournamentTeamCount,
} from '@/app/actions/tournament'
import { AdminRevealSwitch } from '@/components/tournament/admin-reveal-switch'
import { BracketTabs } from '@/components/tournament/tournament-tabs'
import { PageError } from '@/components/ui/page-error'
import { PageLoader } from '@/components/ui/page-loader'
import { useEventAbilities } from '@/hooks/use-event-abilities'
import { useSearchParams } from '@/lib/router-hooks'

export const Route = createFileRoute('/events/$id/bracket')({
  component: BracketRoute,
})

function BracketRoute() {
  const { id } = Route.useParams()
  const searchParams = useSearchParams()
  const isAdminReveal = searchParams.get('adminReveal') === 'true'

  const { abilities, isPending: abilitiesPending } = useEventAbilities(id)
  // Reveal controls need finished match data even with Admin View switched off.
  const fetchAdminMatches = abilities.viewUnrevealedResults

  const matchesQuery = useQuery({
    queryKey: [
      'event',
      id,
      'tournament-matches',
      { adminReveal: fetchAdminMatches },
    ],
    queryFn: () => getTournamentMatches(id, fetchAdminMatches),
    enabled: !abilitiesPending,
  })

  const teamCountQuery = useQuery({
    queryKey: ['event', id, 'tournament-team-count'],
    queryFn: () => getTournamentTeamCount(id),
  })

  const teamsQuery = useQuery({
    queryKey: [
      'event',
      id,
      'teams',
      {
        sortColumn: 'score',
        sortDirection: 'desc',
        adminReveal: false,
      },
    ],
    queryFn: () => getTeamsForEventTable(id, undefined, 'score', 'desc', false),
  })

  if (
    matchesQuery.isPending ||
    teamCountQuery.isPending ||
    teamsQuery.isPending ||
    abilitiesPending
  ) {
    return <PageLoader frame="workspace" />
  }

  if (matchesQuery.isError || teamCountQuery.isError || teamsQuery.isError) {
    return (
      <PageError
        title="Tournament Tree"
        description="Failed to load tournament tree data."
      />
    )
  }

  return (
    <PageLayout frame="workspace">
      <PageHeader
        title="Tournament Tree"
        description="Follow the elimination bracket to see which teams advance and ultimately compete in the finals."
        actions={abilities.viewUnrevealedResults && <AdminRevealSwitch />}
      />
      <BracketTabs
        eventId={id}
        matches={matchesQuery.data}
        teams={teamsQuery.data}
        abilities={abilities}
        teamCount={teamCountQuery.data}
        isAdminReveal={isAdminReveal}
      />
    </PageLayout>
  )
}
