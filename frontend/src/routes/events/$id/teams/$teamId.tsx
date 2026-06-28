import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { getTeamById, getTeamMembers } from '@/app/actions/team'
import { getMatchesForTeam } from '@/app/actions/tournament'
import QueueMatchesList from '@/components/QueueMatchesList'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>{teamQuery.data.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Repository</p>
            <p className="font-medium">{teamQuery.data.repo || 'Pending'}</p>
            <p className="text-sm text-muted-foreground">Queue Score</p>
            <p className="font-medium">{teamQuery.data.queueScore}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {(membersQuery.data ?? []).map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-md border px-3 py-2"
              >
                <Avatar>
                  <AvatarImage src={member.profilePicture} alt={member.name} />
                  <AvatarFallback>
                    {member.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{member.username}</p>
                  <p className="text-sm text-muted-foreground">{member.name}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="mt-6">
        <QueueMatchesList eventId={id} matches={matchesQuery.data ?? []} />
      </div>
    </main>
  )
}
