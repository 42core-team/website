'use client'

import type { KeyboardEvent, MouseEvent } from 'react'
import type { Match } from '@/app/actions/tournament-model'
import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { MatchState } from '@/app/actions/tournament-model'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useParams, useRouter } from '@/lib/router-hooks'

export interface MatchRound {
  round: number
  matches: Match[]
  counts: Record<MatchState, number>
}

export interface MyRoundResult {
  outcome: 'Won' | 'Lost' | 'Tied'
  opponentName: string
}

export function groupMatchesByRound(matches: Match[]): MatchRound[] {
  const matchesByRound = new Map<number, Match[]>()

  matches.forEach((match) => {
    const roundMatches = matchesByRound.get(match.round) ?? []
    roundMatches.push(match)
    matchesByRound.set(match.round, roundMatches)
  })

  return [...matchesByRound.entries()]
    .sort(([left], [right]) => left - right)
    .map(([round, roundMatches]) => ({
      round,
      matches: roundMatches,
      counts: {
        [MatchState.PLANNED]: roundMatches.filter(
          (match) => match.state === MatchState.PLANNED,
        ).length,
        [MatchState.IN_PROGRESS]: roundMatches.filter(
          (match) => match.state === MatchState.IN_PROGRESS,
        ).length,
        [MatchState.FINISHED]: roundMatches.filter(
          (match) => match.state === MatchState.FINISHED,
        ).length,
      },
    }))
}

export function getMyRoundResult(
  round: MatchRound,
  myTeamId?: string,
): MyRoundResult | null {
  if (!myTeamId) return null

  const match = round.matches.find(
    (candidate) =>
      hasVisibleCompetitors(candidate) &&
      candidate.teams.some((team) => team.id === myTeamId),
  )
  if (!match) return null

  const opponent = match.teams.find((team) => team.id !== myTeamId)
  const outcome = match.winner
    ? match.winner.id === myTeamId
      ? 'Won'
      : 'Lost'
    : 'Tied'

  return { outcome, opponentName: opponent?.name ?? 'TBD' }
}

interface GroupPhaseGraphViewProps {
  matches: Match[]
  isEventAdmin: boolean
  myTeamId?: string
}

export function GroupPhaseGraphView({
  matches,
  isEventAdmin,
  myTeamId,
}: GroupPhaseGraphViewProps) {
  const rounds = groupMatchesByRound(matches)
  const router = useRouter()
  const params = useParams()
  const eventId = params.id ?? ''

  if (matches.length === 0) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-xl border bg-card/50 px-6 text-center text-sm text-muted-foreground">
        Matches will appear here once the group phase starts.
      </div>
    )
  }

  const openMatch = (match: Match) => {
    if (match.id && (match.state === MatchState.FINISHED || isEventAdmin)) {
      router.push(`/events/${eventId}/match/${match.id}`)
    }
  }

  const openTeam = (teamId: string) => {
    router.push(`/events/${eventId}/teams/${teamId}`)
  }

  return (
    <UnifiedRounds
      key={eventId}
      rounds={rounds}
      isEventAdmin={isEventAdmin}
      openMatch={openMatch}
      openTeam={openTeam}
      myTeamId={myTeamId}
      persistenceKey={`group-phase:${eventId}`}
    />
  )
}

interface RoundRendererProps {
  rounds: MatchRound[]
  isEventAdmin: boolean
  openMatch: (match: Match) => void
  openTeam: (teamId: string) => void
  myTeamId?: string
  persistenceKey: string
}

function UnifiedRounds({
  rounds,
  isEventAdmin,
  openMatch,
  openTeam,
  myTeamId,
  persistenceKey,
}: RoundRendererProps) {
  const allRoundValues = rounds.map((round) => getRoundValue(round.round))
  const [openRounds, setOpenRounds] = useState<string[]>(() =>
    readPersistedOpenRounds(persistenceKey, allRoundValues),
  )

  useEffect(() => {
    window.sessionStorage.setItem(
      `${persistenceKey}:rounds`,
      JSON.stringify(openRounds),
    )
  }, [openRounds, persistenceKey])

  useEffect(() => {
    const scrollKey = `${persistenceKey}:scroll`
    const savedScrollPosition = Number(window.sessionStorage.getItem(scrollKey))
    let firstFrame = 0
    let secondFrame = 0

    if (Number.isFinite(savedScrollPosition) && savedScrollPosition > 0) {
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          window.scrollTo({ top: savedScrollPosition, behavior: 'instant' })
        })
      })
    }

    const saveScrollPosition = () => {
      window.sessionStorage.setItem(scrollKey, String(window.scrollY))
    }
    window.addEventListener('scroll', saveScrollPosition, { passive: true })

    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
      saveScrollPosition()
      window.removeEventListener('scroll', saveScrollPosition)
    }
  }, [persistenceKey])

  return (
    <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <Accordion
        type="multiple"
        value={openRounds}
        onValueChange={setOpenRounds}
      >
        {rounds.map((round) => (
          <AccordionItem
            key={round.round}
            value={getRoundValue(round.round)}
            className="last:border-b-0"
          >
            <AccordionTrigger className="bg-muted/50 px-4 py-3 hover:bg-muted/70 hover:no-underline">
              <RoundHeading round={round} myTeamId={myTeamId} />
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <RoundMatchTable
                round={round}
                isEventAdmin={isEventAdmin}
                openMatch={openMatch}
                openTeam={openTeam}
                myTeamId={myTeamId}
              />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

function RoundHeading({
  round,
  myTeamId,
}: {
  round: MatchRound
  myTeamId?: string
}) {
  const myResult = getMyRoundResult(round, myTeamId)

  return (
    <div className="flex min-w-0 flex-1 flex-col justify-between gap-1 pr-3 sm:flex-row sm:items-center sm:gap-4">
      <span className="flex min-w-0 flex-col gap-0.5 text-left">
        <span className="font-semibold tracking-tight">
          Round {round.round + 1}
        </span>
        {myResult && (
          <span className="truncate text-xs font-normal text-muted-foreground/80">
            You: {myResult.outcome} vs {myResult.opponentName}
          </span>
        )}
      </span>
      <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-normal text-muted-foreground">
        <span>{round.counts[MatchState.PLANNED]} planned</span>
        <span>{round.counts[MatchState.IN_PROGRESS]} active</span>
        <span>{round.counts[MatchState.FINISHED]} finished</span>
      </span>
    </div>
  )
}

function RoundMatchTable({
  round,
  isEventAdmin,
  openMatch,
  openTeam,
  myTeamId,
}: Omit<RoundRendererProps, 'rounds' | 'persistenceKey'> & {
  round: MatchRound
}) {
  return (
    <Table className="text-xs">
      <TableHeader className="bg-card">
        <TableRow>
          <TableHead className="min-w-44">Team 1</TableHead>
          <TableHead className="w-28 text-center">Score</TableHead>
          <TableHead className="min-w-44">Team 2</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {round.matches.map((match, matchIndex) => (
          <MatchRow
            key={match.id ?? `${round.round}-${matchIndex}`}
            match={match}
            isEventAdmin={isEventAdmin}
            openMatch={openMatch}
            openTeam={openTeam}
            myTeamId={myTeamId}
          />
        ))}
      </TableBody>
    </Table>
  )
}

interface MatchRowProps {
  match: Match
  isEventAdmin: boolean
  openMatch: (match: Match) => void
  openTeam: (teamId: string) => void
  myTeamId?: string
}

function MatchRow({
  match,
  isEventAdmin,
  openMatch,
  openTeam,
  myTeamId,
}: MatchRowProps) {
  const canOpen = Boolean(
    match.id && (match.state === MatchState.FINISHED || isEventAdmin),
  )
  const isOwnMatch = Boolean(
    hasVisibleCompetitors(match) &&
    myTeamId &&
    match.teams.some((team) => team.id === myTeamId),
  )
  const home = hasVisibleCompetitors(match) ? match.teams[0] : undefined
  const away = hasVisibleCompetitors(match) ? match.teams[1] : undefined

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (canOpen && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      openMatch(match)
    }
  }

  return (
    <TableRow
      role={canOpen ? 'link' : undefined}
      className={cn(
        canOpen && 'cursor-pointer',
        'h-10',
        isOwnMatch &&
          'border-l-4 border-l-primary bg-primary/10 hover:bg-primary/15',
      )}
      onClick={() => openMatch(match)}
      onKeyDown={handleKeyDown}
      tabIndex={canOpen ? 0 : undefined}
      aria-label={canOpen ? `Open match ${match.id}` : undefined}
      data-own-team={isOwnMatch ? 'true' : undefined}
    >
      <TeamCell
        team={home}
        match={match}
        side="home"
        openTeam={openTeam}
        isMyTeam={home?.id === myTeamId}
      />
      <TableCell className="px-2 py-1 text-center">
        <ScoreLine match={match} home={home} away={away} />
      </TableCell>
      <TeamCell
        team={away}
        match={match}
        side="away"
        openTeam={openTeam}
        isMyTeam={away?.id === myTeamId}
      />
    </TableRow>
  )
}

function TeamCell({
  team,
  match,
  side,
  openTeam,
  isMyTeam,
}: {
  team: Match['teams'][number] | undefined
  match: Match
  side: 'home' | 'away'
  openTeam: (teamId: string) => void
  isMyTeam: boolean
}) {
  if (!team) {
    return (
      <TableCell className="px-3 py-2 text-muted-foreground">TBD</TableCell>
    )
  }

  const isWinner = team.id === match.winner?.id

  return (
    <TableCell
      className={cn(
        'px-3 py-1.5',
        isWinner && 'bg-amber-500/10',
        isWinner && side === 'home' && 'border-l-2 border-l-amber-500',
        isWinner && side === 'away' && 'border-r-2 border-r-amber-500',
      )}
    >
      <button
        type="button"
        className={cn(
          'inline-flex max-w-full items-center gap-1.5 rounded-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'text-xs',
          isWinner && 'font-semibold text-amber-700 dark:text-amber-300',
        )}
        onClick={(event) => stopAndOpenTeam(event, team.id, openTeam)}
      >
        <span className="truncate">{team.name}</span>
        {isWinner && (
          <Trophy
            className="size-3.5 shrink-0 text-amber-500"
            aria-label="Winner"
          />
        )}
        {isMyTeam && (
          <Badge
            variant="outline"
            className="shrink-0 border-primary/30 bg-primary/10 px-1.5 py-0 text-[10px] text-primary"
          >
            You
          </Badge>
        )}
      </button>
    </TableCell>
  )
}

function ScoreLine({
  match,
  home,
  away,
}: {
  match: Match
  home?: Match['teams'][number]
  away?: Match['teams'][number]
}) {
  if (match.state !== MatchState.FINISHED) {
    return <MatchStateBadge state={match.state} />
  }

  if (!home || !away) {
    return <span className="text-muted-foreground">—</span>
  }

  const homeScore = getTeamScore(match, home.id, home.score)
  const awayScore = getTeamScore(match, away.id, away.score)

  return (
    <span
      aria-label={`Score ${homeScore} to ${awayScore}`}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap font-mono font-bold tabular-nums',
        'min-w-16 rounded-md border bg-muted/50 px-2 py-0.5 text-sm',
      )}
    >
      {homeScore} <span className="mx-1.5 opacity-60">–</span> {awayScore}
    </span>
  )
}

function stopAndOpenTeam(
  event: MouseEvent<HTMLButtonElement>,
  teamId: string,
  openTeam: (teamId: string) => void,
) {
  event.stopPropagation()
  openTeam(teamId)
}

export function hasVisibleCompetitors(match: Match): boolean {
  return match.state === MatchState.FINISHED && match.teams.length > 0
}

export function getTeamScore(
  match: Match,
  teamId: string,
  fallbackScore: number,
): number {
  return (
    match.results.find((result) => result.team.id === teamId)?.score ??
    fallbackScore
  )
}

function getRoundValue(round: number): string {
  return `round-${round}`
}

function readPersistedOpenRounds(
  persistenceKey: string,
  allowedValues: string[],
): string[] {
  if (typeof window === 'undefined') return allowedValues.slice(0, 1)

  const storedValue = window.sessionStorage.getItem(`${persistenceKey}:rounds`)
  if (storedValue === null) return allowedValues.slice(0, 1)

  try {
    const parsedValue: unknown = JSON.parse(storedValue)
    if (!Array.isArray(parsedValue)) return allowedValues.slice(0, 1)
    return parsedValue.filter(
      (value): value is string =>
        typeof value === 'string' && allowedValues.includes(value),
    )
  } catch {
    return allowedValues.slice(0, 1)
  }
}

function MatchStateBadge({ state }: { state: MatchState }) {
  const label =
    state === MatchState.IN_PROGRESS
      ? 'Active'
      : state === MatchState.PLANNED
        ? 'Planned'
        : null

  if (!label) return null

  return (
    <Badge
      variant="outline"
      className={cn(
        'whitespace-nowrap',
        state === MatchState.IN_PROGRESS &&
          'border-orange-600/30 bg-orange-500/10 text-orange-700 dark:text-orange-400',
        state === MatchState.PLANNED && 'text-muted-foreground',
      )}
    >
      {label}
    </Badge>
  )
}
