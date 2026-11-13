import { TeamPicture } from '@/components/team/TeamAppearance'
import type { QueueMatch } from '@/app/actions/tournament-model'
import { Trophy } from 'lucide-react'
import Link from '@/components/app-link'
import { MatchPhase, MatchState } from '@/app/actions/tournament-model'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function getVisibleMatchResultScores(
  match: Pick<QueueMatch, 'phase' | 'results'>,
): Map<string, number> {
  if (match.phase === MatchPhase.QUEUE) return new Map()

  return new Map(
    match.results?.map((result) => [result.team.id, result.score]) ?? [],
  )
}

type ListedMatch = QueueMatch & { eventId: string }

type MatchesListProps = {
  isInsideCard?: boolean
  teamId?: string
  emptyMessage?: string
} & (
  | {
      /** The event all listed matches belong to. */
      eventId: string
      matches: QueueMatch[]
    }
  | {
      /** Matches of several events each name their own. */
      eventId?: undefined
      matches: ListedMatch[]
    }
)

export default function MatchesList(props: MatchesListProps) {
  const {
    isInsideCard,
    teamId,
    emptyMessage = 'No match making matches found',
  } = props
  const listEventId = props.eventId
  const matches: ListedMatch[] =
    listEventId === undefined
      ? props.matches
      : props.matches.map((match) => ({ ...match, eventId: listEventId }))

  if (matches.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12 text-center',
          !isInsideCard && 'border rounded-lg bg-muted/10',
        )}
      >
        <p className="font-medium text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  const listContent = (
    <div className={cn('flex flex-col', isInsideCard ? 'divide-y' : 'gap-4')}>
      {matches.map((match, index) => {
        const matchEventId = match.eventId
        const resultScores = getVisibleMatchResultScores(match)
        const teams = [...match.teams]
        const viewedTeamIndex = teams.findIndex((team) => team.id === teamId)
        if (viewedTeamIndex > 0) {
          const [viewedTeam] = teams.splice(viewedTeamIndex, 1)
          teams.unshift(viewedTeam)
        }
        const content = (
          // Phones stack the two teams and keep the replay button beside
          // them; from sm up the teams face each other across VS.
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center sm:flex sm:flex-row sm:items-stretch">
            {/* Match Meta */}
            <div
              className={cn(
                'col-span-2 px-4 pt-3 pb-2 sm:py-3 shrink-0 sm:w-52 bg-muted/10 flex flex-row sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-2',
                !isInsideCard &&
                  'bg-muted/20 border-b sm:border-b-0 sm:border-r',
              )}
            >
              <div className="flex flex-wrap gap-1.5">
                <Badge
                  variant={
                    match.state === MatchState.FINISHED
                      ? 'secondary'
                      : 'default'
                  }
                  className={cn(
                    'text-[10px] uppercase font-bold px-1.5',
                    match.state === MatchState.FINISHED &&
                      'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400 border-success-200/50',
                    match.state === MatchState.IN_PROGRESS &&
                      'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400 border-warning-200/50',
                  )}
                >
                  {match.state}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-border/50 px-1.5 text-[10px] font-bold text-muted-foreground uppercase"
                >
                  {match.phase === MatchPhase.QUEUE && 'Match Making'}
                  {match.phase === MatchPhase.SWISS && 'Swiss'}
                  {match.phase === MatchPhase.ELIMINATION && 'Tournament'}
                  {match.phase === MatchPhase.MANUAL && 'Manual'}
                </Badge>
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {new Date(match.createdAt).toLocaleDateString()}
                <span className="text-muted-foreground/60">
                  {' · '}
                  {new Date(match.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </span>
            </div>

            {/* Match Content */}
            <div
              className={cn(
                'flex min-w-0 flex-1 items-center justify-center px-4 pt-1 pb-3 sm:p-6',
                !isInsideCard && 'pt-3',
              )}
            >
              <div className="flex w-full max-w-4xl min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
                {([0, 1] as const).map((side) => {
                  const team = teams.at(side)
                  const isWinner = Boolean(team && match.winner?.id === team.id)
                  const isLoser = Boolean(match.winner && !isWinner)
                  // Picture sits on the inner edge next to VS so it lines up
                  // across rows; name and trophy extend toward the outside.
                  const teamName = team && (
                    <>
                      <TeamPicture
                        team={team}
                        className={cn(
                          'size-7 rounded-md ring-1 ring-border sm:size-8',
                          side === 0 && 'sm:order-last',
                          isLoser && 'opacity-60 grayscale',
                        )}
                        fallbackClassName="rounded-md bg-muted text-[10px] text-muted-foreground"
                      />
                      <span
                        className={cn(
                          'min-w-0 truncate',
                          team.deletedAt && 'line-through',
                        )}
                      >
                        {team.name}
                      </span>
                      {isWinner && (
                        <Trophy
                          aria-label="Winner"
                          className={cn(
                            'size-4 shrink-0 text-amber-500',
                            side === 0 && 'sm:order-first',
                          )}
                        />
                      )}
                    </>
                  )
                  const nameClassName = cn(
                    'flex w-full min-w-0 items-center gap-2.5 text-sm font-semibold sm:text-base',
                    side === 0
                      ? 'text-left sm:justify-end sm:text-right'
                      : 'text-left',
                  )

                  return (
                    <div key={side} className="contents">
                      {side === 1 && (
                        <div className="hidden shrink-0 items-center justify-center sm:flex">
                          <span className="text-xs font-bold text-muted-foreground/50">
                            VS
                          </span>
                        </div>
                      )}
                      <div
                        className={cn(
                          'flex min-w-0 items-center gap-3 sm:flex-1 sm:flex-col sm:gap-1',
                          side === 0 ? 'sm:items-end' : 'sm:items-start',
                        )}
                      >
                        {team ? (
                          <>
                            {team.deletedAt ? (
                              <div
                                className={cn(
                                  nameClassName,
                                  'text-muted-foreground/50',
                                )}
                              >
                                {teamName}
                              </div>
                            ) : (
                              <Link
                                href={`/events/${matchEventId}/teams/${team.id}`}
                                className={cn(
                                  nameClassName,
                                  'transition-colors hover:text-primary hover:underline',
                                  isWinner
                                    ? 'text-foreground'
                                    : 'text-muted-foreground',
                                )}
                              >
                                {teamName}
                              </Link>
                            )}
                            {resultScores.has(team.id) && (
                              <span
                                className={cn(
                                  'text-lg leading-none sm:text-3xl sm:leading-normal font-bold tracking-tighter',
                                  isWinner
                                    ? 'text-foreground'
                                    : 'text-muted-foreground/40',
                                )}
                              >
                                {resultScores.get(team.id)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground/40 italic">
                            Unknown
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Replay */}
            <div
              className={cn(
                'flex items-center justify-center shrink-0 pr-4 pb-3 sm:w-32 sm:px-6 sm:pb-0',
                !isInsideCard && 'sm:border-l border-border/40',
              )}
            >
              {match.id && match.state === MatchState.FINISHED && (
                <Link href={`/events/${matchEventId}/match/${match.id}`}>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-xs font-bold uppercase"
                  >
                    Replay
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )

        if (isInsideCard) {
          return (
            <div key={match.id || index} className="w-full">
              {content}
            </div>
          )
        }

        return (
          <Card
            key={match.id || index}
            className="overflow-hidden border shadow-sm"
          >
            <CardContent className="p-0">{content}</CardContent>
          </Card>
        )
      })}
    </div>
  )

  return listContent
}
