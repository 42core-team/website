'use client'

import type { Team } from '@/app/actions/team'
import type { Match } from '@/app/actions/tournament-model'
import { Fragment } from 'react'
import { MatchState } from '@/app/actions/tournament-model'
import { MatchHistoryBadges } from '@/components/match/MatchHistoryBadges'
import { LocationTags } from '@/components/team'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useRouter } from '@/lib/router-hooks'

interface GroupPhaseRankingTableProps {
  teams: Team[]
  matches: Match[]
  eventId: string
  advancementCount: number
}

export function GroupPhaseRankingTable({
  teams,
  matches,
  eventId,
  advancementCount,
}: GroupPhaseRankingTableProps) {
  const router = useRouter()

  const sortedTeams = [...teams].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.buchholzPoints - a.buchholzPoints
  })

  const getMatchHistory = (teamId: string) =>
    matches
      .filter(
        (match) =>
          match.state === MatchState.FINISHED &&
          match.teams.some((team) => team.id === teamId),
      )
      .sort((a, b) => a.round - b.round)
      .map((match) => ({
        id: match.id ?? '',
        result: match.winner ? (match.winner.id === teamId ? 'W' : 'L') : 'T',
      }))
      .filter((match) => match.id)

  return (
    <div className="w-full overflow-hidden rounded-xl border bg-card/50 px-2 py-1 shadow-sm md:rounded-2xl">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Rank</TableHead>
            <TableHead>Participant</TableHead>
            <TableHead className="text-center">Score</TableHead>
            <TableHead className="text-center">Buchholz</TableHead>
            <TableHead className="text-center">Byes</TableHead>
            <TableHead className="text-right">Match History</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTeams.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-24 text-center text-muted-foreground"
              >
                Rankings will appear once teams join the event.
              </TableCell>
            </TableRow>
          ) : (
            sortedTeams.map((team, index) => {
              const rank = index + 1
              const history = getMatchHistory(team.id)
              const isAtCutoff = rank === advancementCount

              return (
                <Fragment key={team.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      router.push(`/events/${eventId}/teams/${team.id}`)
                    }
                  >
                    <TableCell>{rank}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{team.name}</span>
                        <LocationTags tags={team.tags} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-bold">
                      {team.score.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-center">
                      {team.buchholzPoints.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono">
                        {team.hadBye ? '+1.0' : '0'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <MatchHistoryBadges
                          history={history}
                          eventId={eventId}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                  {isAtCutoff && index < sortedTeams.length - 1 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        <div className="flex h-full w-full items-center gap-4 px-4">
                          <div className="h-px flex-1 bg-emerald-500/50" />
                          <span className="text-[10px] font-bold tracking-widest text-emerald-500/80 uppercase">
                            Advancement Cutoff
                          </span>
                          <div className="h-px flex-1 bg-emerald-500/50" />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
