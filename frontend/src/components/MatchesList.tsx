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

export default function MatchesList(props: {
  eventId: string
  matches: QueueMatch[]
  isInsideCard?: boolean
  teamId?: string
}) {
  const { eventId, matches, isInsideCard, teamId } = props

  if (matches.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12 text-center',
          !isInsideCard && 'border rounded-lg bg-muted/10',
        )}
      >
        <p className="font-medium text-muted-foreground">
          No match making matches found
        </p>
      </div>
    )
  }

  const listContent = (
    <div className={cn('flex flex-col', isInsideCard ? 'divide-y' : 'gap-4')}>
      {matches.map((match, index) => {
        const resultScores = getVisibleMatchResultScores(match)
        const teams = [...match.teams]
        const viewedTeamIndex = teams.findIndex((team) => team.id === teamId)
        if (viewedTeamIndex > 0) {
          const [viewedTeam] = teams.splice(viewedTeamIndex, 1)
          teams.unshift(viewedTeam)
        }
        const content = (
          <div className="flex flex-col items-stretch sm:flex-row">
            {/* Match Meta */}
            <div
              className={cn(
                'px-4 py-3 shrink-0 sm:w-52 bg-muted/10 flex flex-row sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-2',
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
            <div className="flex min-w-0 flex-1 items-center justify-center p-4 sm:p-6">
              <div className="flex w-full max-w-4xl min-w-0 items-center justify-center gap-3 sm:gap-4">
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
                          'size-8 rounded-md ring-1 ring-border',
                          side === 0 && 'order-last',
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
                            side === 0 && 'order-first',
                          )}
                        />
                      )}
                    </>
                  )
                  const nameClassName = cn(
                    'flex w-full min-w-0 items-center gap-2.5 text-sm font-semibold sm:text-base',
                    side === 0 ? 'justify-end text-right' : 'text-left',
                  )

                  return (
                    <div key={side} className="contents">
                      {side === 1 && (
                        <div className="flex shrink-0 items-center justify-center">
                          <span className="text-xs font-bold text-muted-foreground/50">
                            VS
                          </span>
                        </div>
                      )}
                      <div
                        className={cn(
                          'flex min-w-0 flex-1 flex-col gap-1',
                          side === 0 ? 'items-end' : 'items-start',
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
                                href={`/events/${eventId}/teams/${team.id}`}
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
                                  'text-2xl sm:text-3xl font-bold tracking-tighter',
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
                'flex items-center justify-center shrink-0 px-6 sm:w-32 pb-4 sm:pb-0',
                !isInsideCard && 'sm:border-l border-border/40',
              )}
            >
              {match.id && match.state === MatchState.FINISHED && (
                <Link href={`/events/${eventId}/match/${match.id}`}>
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
