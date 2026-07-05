import type { Team } from '@/app/actions/team'
import { useQuery } from '@tanstack/react-query'
import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { getTeamsForEventTable } from '@/app/actions/team'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const Route = createFileRoute('/events/$id/teams')({
  component: TeamsRoute,
})

function TeamsRoute() {
  const { id } = Route.useParams()
  const isTeamsOverview = useLocation({
    select: (location) =>
      location.pathname === `/events/${id}/teams` ||
      location.pathname === `/events/${id}/teams/`,
  })
  const navigate = useNavigate()
  const teamsQuery = useQuery({
    queryKey: ['event', id, 'teams'],
    queryFn: () => getTeamsForEventTable(id),
  })

  if (!isTeamsOverview) {
    return <Outlet />
  }

  if (teamsQuery.isPending) {
    return (
      <main className="flex min-h-[45vh] items-center justify-center">
        <Spinner />
      </main>
    )
  }

  if (teamsQuery.isError) {
    return (
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <p className="text-center text-destructive">Failed to load teams.</p>
      </main>
    )
  }

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Teams</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Queue Score</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamsQuery.data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    No teams found
                  </TableCell>
                </TableRow>
              ) : (
                teamsQuery.data.map((team: Team) => (
                  <TableRow
                    onClick={() => {
                      navigate({
                        to: '/events/$id/teams/$teamId',
                        params: {
                          id: id,
                          teamId: team.id,
                        },
                      })
                    }}
                    key={team.id}
                    className="hover:bg-muted/50 cursor-pointer"
                  >
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell>{team.membersCount ?? '-'}</TableCell>
                    <TableCell>{team.queueScore}</TableCell>
                    <TableCell>
                      {team.createdAt
                        ? new Date(team.createdAt).toLocaleDateString()
                        : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  )
}
