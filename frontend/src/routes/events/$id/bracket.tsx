import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { getTeamsForEventTable } from '@/app/actions/team'
import {
  getTournamentMatches,
  getTournamentTeamCount,
} from '@/app/actions/tournament'
import { AdminRevealSwitch } from '@/components/tournament/admin-reveal-switch'
import { BracketTabs } from '@/components/tournament/tournament-tabs'
import { Spinner } from '@/components/ui/spinner'
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
    return (
      <main className="flex min-h-[45vh] items-center justify-center">
        <Spinner />
      </main>
    )
  }

  if (matchesQuery.isError || teamCountQuery.isError || teamsQuery.isError) {
    return (
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <p className="text-center text-destructive">
          Failed to load tournament tree data.
        </p>
      </main>
    )
  }

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-col gap-4 pb-8 md:gap-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="space-y-1.5 md:space-y-2">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Tournament Tree
            </h1>
            <p className="max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Follow the elimination bracket to see which teams advance and
              ultimately compete in the finals.
            </p>
          </div>
          {abilities.viewUnrevealedResults && (
            <div className="flex-shrink-0">
              <AdminRevealSwitch />
            </div>
          )}
        </div>

        <BracketTabs
          eventId={id}
          matches={matchesQuery.data}
          teams={teamsQuery.data}
          abilities={abilities}
          teamCount={teamCountQuery.data}
          isAdminReveal={isAdminReveal}
        />
      </div>
    </main>
  )
}
