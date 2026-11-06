import type { Match } from '@/app/actions/tournament-model'
import { MatchPhase } from '@/app/actions/tournament-model'
import { Link } from '@tanstack/react-router'
import { TeamCover, TeamPicture } from '@/components/team/TeamAppearance'
import { cn } from '@/lib/utils'

/** The match-up, mirrored around "VS", sized to fill a navbar's center slot. */
export function MatchTeamHeader({
  match,
  eventId,
}: {
  match: Match
  eventId: string
}) {
  return (
    <section
      aria-label="Match teams"
      className="flex min-w-0 flex-1 items-stretch self-stretch"
    >
      {match.teams.map((team, index) => {
        const isFirst = index === 0
        const score =
          match.isRevealed && match.phase !== MatchPhase.QUEUE
            ? match.results?.find((result) => result.team.id === team.id)?.score
            : undefined
        return (
          <div key={team.id} className="contents">
            {!isFirst && (
              <div className="flex items-center justify-center px-2 text-sm font-bold text-muted-foreground lg:px-4">
                VS
              </div>
            )}
            <Link
              to="/events/$id/teams/$teamId"
              params={{ id: eventId, teamId: team.id }}
              title={team.name}
              aria-label={[team.name, score !== undefined && `score ${score}`]
                .filter(Boolean)
                .join(', ')}
              className={cn(
                'relative flex min-w-0 flex-1 items-center gap-2 lg:gap-3 lg:text-white',
                // The cover fades out most on the outer side, so the text keeps off it.
                isFirst ? 'flex-row-reverse lg:pl-[14%]' : 'lg:pr-[14%]',
              )}
            >
              <div
                className={cn(
                  'absolute inset-0 hidden lg:block',
                  isFirst
                    ? '[mask-image:linear-gradient(to_left,transparent,black_2.5rem,black_60%,transparent)]'
                    : '[mask-image:linear-gradient(to_right,transparent,black_2.5rem,black_60%,transparent)]',
                )}
              >
                <TeamCover
                  team={team}
                  className="absolute inset-0 aspect-auto h-full rounded-none"
                />
                <div className="absolute inset-0 bg-black/55" />
              </div>
              <TeamPicture
                team={team}
                className={cn(
                  'relative size-10',
                  isFirst ? 'lg:mr-3' : 'lg:ml-3',
                )}
                fallbackClassName="lg:bg-black/40 lg:text-white"
              />
              <span className="relative hidden min-w-0 truncate font-semibold lg:block">
                {team.name}
              </span>
              {score !== undefined && (
                <span className="relative hidden shrink-0 text-xl font-bold tabular-nums sm:block">
                  {score}
                </span>
              )}
            </Link>
          </div>
        )
      })}
    </section>
  )
}
