import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { getTeamById, getTeamMembers } from '@/app/actions/team'
import { getMatchesForTeam } from '@/app/actions/tournament'
import { TeamMatchHistory, TeamPublicProfile } from '@/components/team'
import { Spinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/events/$id/teams/$teamId')({
  component: TeamRoute,
})

function TeamRoute() {
  const { id, teamId } = Route.useParams()
  const teamQuery = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => getTeamById(teamId),
  })
  const membersQuery = useQuery({
    queryKey: ['team', teamId, 'members'],
    queryFn: () => getTeamMembers(teamId),
  })
  const matchesQuery = useQuery({
    queryKey: ['team', teamId, 'matches'],
    queryFn: () => getMatchesForTeam(teamId),
  })

  if (teamQuery.isPending) {
    return (
      <main className="flex min-h-[45vh] items-center justify-center">
        <Spinner />
      </main>
    )
  }

  if (teamQuery.isError || !teamQuery.data) {
    return (
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <p className="text-center text-destructive">Team not found.</p>
      </main>
    )
  }

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <TeamPublicProfile
        team={teamQuery.data}
        members={membersQuery.data ?? []}
      />
      <div className="mt-6">
        <TeamMatchHistory
          eventId={id}
          matches={matchesQuery.data ?? []}
          isLoading={matchesQuery.isPending}
          isError={matchesQuery.isError}
        />
      </div>
    </main>
  )
}
