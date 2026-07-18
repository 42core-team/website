'use client'

import type { Team } from '@/app/actions/team'
import type { Match } from '@/app/actions/tournament-model'
import { Award, Medal, Trophy } from 'lucide-react'
import { useMemo } from 'react'
import { MatchState } from '@/app/actions/tournament-model'
import { MatchHistoryBadges } from '@/components/match/MatchHistoryBadges'
import { LocationTags } from '@/components/team'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useRouter, useSearchParams } from '@/lib/router-hooks'

interface BracketRankingTableProps {
  teams: Team[]
  matches: Match[]
  eventId: string
  isEventAdmin?: boolean
}

export function BracketRankingTable({
  teams,
  matches,
  eventId,
  isEventAdmin,
}: BracketRankingTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const shouldReveal =
    isEventAdmin && searchParams.get('adminReveal') === 'true'

  const revealedMatches = useMemo(
    () => matches.filter((match) => match.isRevealed || shouldReveal),
    [matches, shouldReveal],
  )
  const maxRound = useMemo(
    () => Math.max(...matches.map((match) => match.round), 1),
    [matches],
  )

  const teamStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        highestRound: number
        actualRank: number
        history: { id: string; result: string }[]
        hasMatches: boolean
      }
    >()

    for (const team of teams) {
      const teamId = team.id
      const teamMatches = revealedMatches.filter((match) =>
        match.teams.some((matchTeam) => matchTeam.id === teamId),
      )
      const highestRound = Math.max(
        ...teamMatches.map((match) => match.round),
        0,
      )
      const lastMatch = teamMatches.find(
        (match) => match.round === highestRound,
      )
      const isWinner = lastMatch?.winner?.id === teamId
      const hasWinner = Boolean(lastMatch?.winner)

      let actualRank = 0
      if (highestRound === maxRound && highestRound > 0) {
        if (lastMatch?.isPlacementMatch) {
          actualRank = isWinner ? 3 : hasWinner ? 4 : 3
        } else {
          actualRank = isWinner ? 1 : hasWinner ? 2 : 1
        }
      } else {
        const effectiveRound = isWinner ? highestRound + 1 : highestRound
        actualRank = 2 ** (maxRound - effectiveRound) + 1
      }

      const history = teamMatches
        .filter((match) => match.state === MatchState.FINISHED)
        .sort((a, b) => a.round - b.round)
        .map((match) => ({
          id: match.id ?? '',
          result: match.winner ? (match.winner.id === teamId ? 'W' : 'L') : 'T',
        }))
        .filter((match) => match.id)

      map.set(teamId, {
        highestRound,
        actualRank,
        history,
        hasMatches: teamMatches.length > 0,
      })
    }

    return map
  }, [revealedMatches, maxRound, teams])

  const swissRankMap = new Map(
    [...teams]
      .sort((a, b) =>
        b.score !== a.score
          ? b.score - a.score
          : b.buchholzPoints - a.buchholzPoints,
      )
      .map((team, index) => [team.id, index + 1]),
  )

  const sortedTeams = teams
    .map((team) => ({
      ...team,
      swissRank: swissRankMap.get(team.id),
      ...teamStatsMap.get(team.id),
    }))
    .filter((team) => team.hasMatches)
    .sort((a, b) => {
      if ((a.actualRank ?? 0) !== (b.actualRank ?? 0)) {
        return (a.actualRank ?? 0) - (b.actualRank ?? 0)
      }
      if (b.score !== a.score) return b.score - a.score
      return b.buchholzPoints - a.buchholzPoints
    })

  return (
    <div className="w-full overflow-hidden rounded-xl border bg-card/50 shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px] text-center">Standing</TableHead>
            <TableHead className="w-[100px] text-center">Swiss Rank</TableHead>
            <TableHead className="pl-8">Name</TableHead>
            <TableHead className="pr-7 text-right">Match History</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTeams.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="h-24 text-center text-muted-foreground"
              >
                Matches will appear here once the bracket starts.
              </TableCell>
            </TableRow>
          ) : (
            sortedTeams.map((team) => {
              const rank = team.actualRank ?? 0
              const isWinner = rank === 1
              const isFinalist = rank === 2
              const isSemi = rank === 3
              const rankIcon = isWinner ? (
                <Trophy className="h-6 w-6 text-yellow-500" />
              ) : isFinalist ? (
                <Medal className="h-6 w-6 text-slate-400" />
              ) : isSemi ? (
                <Award className="h-6 w-6 text-amber-700" />
              ) : (
                <span className="font-mono font-bold">{rank}</span>
              )

              return (
                <TableRow
                  key={team.id}
                  className={cn(
                    'group cursor-pointer transition-all hover:bg-muted/40',
                    isWinner &&
                      'border-l-4 border-l-yellow-500 bg-yellow-500/5 hover:bg-yellow-500/10',
                    isFinalist &&
                      'border-l-4 border-l-slate-400 bg-slate-500/5 hover:bg-slate-500/10',
                    isSemi && 'border-l-4 border-l-amber-700/50',
                    !isWinner &&
                      !isFinalist &&
                      !isSemi &&
                      'border-l-4 border-l-transparent border-b border-border/40',
                  )}
                  onClick={() =>
                    router.push(`/events/${eventId}/teams/${team.id}`)
                  }
                >
                  <TableCell className="text-center">
                    <div className="flex justify-center">{rankIcon}</div>
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {team.swissRank}
                  </TableCell>
                  <TableCell className="pl-8">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{team.name}</span>
                      <LocationTags tags={team.tags} />
                    </div>
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <div className="flex justify-end gap-1">
                      <MatchHistoryBadges
                        history={team.history ?? []}
                        eventId={eventId}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
