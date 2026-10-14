import type { Match } from '@/app/actions/tournament-model'
import { Link } from '@tanstack/react-router'
import { TeamCover, TeamPicture } from '@/components/team/TeamAppearance'

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
      className="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]"
    >
      {match.teams.map((team, index) => (
        <div key={team.id} className="contents">
          {index > 0 && (
            <div className="flex items-center justify-center px-2 text-sm font-bold text-muted-foreground">
              VS
            </div>
          )}
          <Link
            to="/events/$id/teams/$teamId"
            params={{ id: eventId, teamId: team.id }}
            className="relative min-w-0 overflow-hidden rounded-xl border bg-muted"
          >
            <TeamCover team={team} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 p-4 text-white">
              <TeamPicture team={team} />
              <span className="min-w-0 truncate text-lg font-semibold">
                {team.name}
              </span>
              {match.isRevealed &&
                match.results?.find((result) => result.team.id === team.id) && (
                  <span className="ml-auto text-2xl font-bold tabular-nums">
                    {
                      match.results.find((result) => result.team.id === team.id)
                        ?.score
                    }
                  </span>
                )}
              {match.isRevealed && match.winner?.id === team.id && (
                <span className="ml-auto rounded-full bg-white/20 px-3 py-1 text-xs">
                  Winner
                </span>
              )}
            </div>
          </Link>
        </div>
      ))}
    </section>
  )
}
