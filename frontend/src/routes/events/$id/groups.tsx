import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { getTeamsForEventTable } from '@/app/actions/team'
import {
  getSwissMatches,
  getTournamentTeamCount,
} from '@/app/actions/tournament'
import { AdminRevealSwitch } from '@/components/tournament/admin-reveal-switch'
import { GroupPhaseTabs } from '@/components/tournament/tournament-tabs'
import { Spinner } from '@/components/ui/spinner'
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
    return (
      <main className="flex min-h-[45vh] items-center justify-center">
        <Spinner />
      </main>
    )
  }

  if (
    matchesQuery.isError ||
    teamsQuery.isError ||
    advancementCountQuery.isError
  ) {
    return (
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <p className="text-center text-destructive">
          Failed to load group phase data.
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
              Group Phase
            </h1>
            <p className="max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
              In the group phase, teams compete using the Swiss tournament
              system, with rankings determined by the Buchholz scoring system.
            </p>
          </div>
          {abilities.viewUnrevealedResults && (
            <div className="flex-shrink-0">
              <AdminRevealSwitch />
            </div>
          )}
        </div>

        <GroupPhaseTabs
          eventId={id}
          matches={matchesQuery.data}
          teams={teamsQuery.data}
          canViewUnrevealedResults={abilities.viewUnrevealedResults}
          advancementCount={advancementCountQuery.data}
        />
      </div>
    </main>
  )
}
