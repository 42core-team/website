import type { Team } from '@/app/actions/team'
import { useQuery } from '@tanstack/react-query'
import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useState } from 'react'
import { getTeamsForEventTable } from '@/app/actions/team'
import { LocationTags } from '@/components/team'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/themed'

export const Route = createFileRoute('/events/$id/teams')({
  component: TeamsRoute,
})

type SortColumn = 'name' | 'membersCount' | 'queueScore' | 'createdAt'
type SortDirection = 'asc' | 'desc'

interface SortableTableHeadProps {
  children: string
  column: SortColumn
  sortColumn: SortColumn
  sortDirection: SortDirection
  onSort: (column: SortColumn) => void
}

function SortableTableHead({
  children,
  column,
  sortColumn,
  sortDirection,
  onSort,
}: SortableTableHeadProps) {
  const isSorted = sortColumn === column
  const SortIcon = isSorted
    ? sortDirection === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown

  const ariaSort = isSorted
    ? sortDirection === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none'

  return (
    <TableHead aria-sort={ariaSort}>
      <Button
        aria-label={`Sort by ${children}`}
        className="-ml-3 h-8 px-3"
        onClick={() => onSort(column)}
        variant="ghost"
      >
        {children}
        <SortIcon className="text-muted-foreground" />
      </Button>
    </TableHead>
  )
}

function TeamsRoute() {
  const { id } = Route.useParams()
  const isTeamsOverview = useLocation({
    select: (location) =>
      location.pathname === `/events/${id}/teams` ||
      location.pathname === `/events/${id}/teams/`,
  })
  const navigate = useNavigate()
  const [sortColumn, setSortColumn] = useState<SortColumn>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const teamsQuery = useQuery({
    queryKey: ['event', id, 'teams', sortColumn, sortDirection],
    queryFn: () =>
      getTeamsForEventTable(id, undefined, sortColumn, sortDirection),
    placeholderData: (previousData) => previousData,
  })

  if (!isTeamsOverview) {
    return <Outlet />
  }

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortColumn(column)
    setSortDirection('asc')
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
                <SortableTableHead
                  column="name"
                  onSort={handleSort}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                >
                  Name
                </SortableTableHead>
                <SortableTableHead
                  column="membersCount"
                  onSort={handleSort}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                >
                  Members
                </SortableTableHead>
                <SortableTableHead
                  column="queueScore"
                  onSort={handleSort}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                >
                  Match Making Rating
                </SortableTableHead>
                <SortableTableHead
                  column="createdAt"
                  onSort={handleSort}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                >
                  Created
                </SortableTableHead>
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
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{team.name}</span>
                        <LocationTags tags={team.tags} />
                      </div>
                    </TableCell>
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
