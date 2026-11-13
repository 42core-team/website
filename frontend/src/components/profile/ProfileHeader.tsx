import type { ReactNode } from 'react'
import type { BracketFinish, UserProfile } from '@/app/actions/profile'
import { format } from 'date-fns'
import { Share2, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { GithubIcon } from '@/components/icons'
import LocationTags from '@/components/team/LocationTags'
import { TeamCover, TeamCoverStripe } from '@/components/team/TeamAppearance'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  finishLabel,
  formatPercent,
  getBestFinish,
  totalMatches,
  winRate,
} from './profile-stats'

function placeLabel(finish: BracketFinish) {
  switch (finish.kind) {
    case 'CHAMPION':
      return '1st'
    case 'RUNNER_UP':
      return '2nd'
    case 'THIRD':
      return '3rd'
    case 'FOURTH':
      return '4th'
    default:
      return finish.roundOf ? `Top ${finish.roundOf}` : '–'
  }
}

/** Identity and career numbers, laid out like a team's public profile. */
export function ProfileHeader({ profile }: { profile: UserProfile }) {
  const { user, teams, summary } = profile
  const coverTeam = teams.find((team) => team.background)
  const { record, streaks } = summary
  const formWins = summary.form.filter((match) => match.result === 'WIN').length
  const best = getBestFinish(teams)
  const onPodium =
    !!best && ['CHAMPION', 'RUNNER_UP', 'THIRD'].includes(best.finish.kind)
  const tournamentEvents = teams.filter(
    (team) => team.finish && team.finish.kind !== 'IN_BRACKET',
  ).length

  const share = async () => {
    const url = `${window.location.origin}/users/${encodeURIComponent(user.username)}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Profile link copied')
    } catch {
      toast.error('Could not copy the link')
    }
  }

  return (
    <Card className="gap-0 overflow-hidden pt-0">
      {coverTeam ? (
        <div className="relative">
          <TeamCover team={coverTeam} className="aspect-auto h-20 sm:h-28" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/20" />
        </div>
      ) : (
        <TeamCoverStripe />
      )}
      <CardHeader className="relative -mt-10 flex flex-col gap-4 space-y-0 px-4 pt-0 pb-4 sm:-mt-2 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        {/* Phones put the picture above the name, so the name gets the
            whole width; from sm up they sit side by side. */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-fit shrink-0 rounded-2xl bg-card p-1 shadow-sm">
            <Avatar className="size-20 shrink-0 rounded-xl border-2 border-background">
              <AvatarImage
                src={user.profilePicture ?? undefined}
                alt=""
                className="object-cover"
              />
              <AvatarFallback className="rounded-md bg-primary/15 text-xl font-semibold text-foreground">
                {(user.name || user.username).slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
              <CardTitle className="text-2xl font-bold break-words sm:text-3xl">
                {user.name || user.username}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <LocationTags tags={user.tags} />
                {onPodium && (
                  <Badge variant="outline" className="gap-1">
                    <Trophy className="size-3.5 text-amber-500" aria-hidden />
                    {finishLabel(best.finish)} · {best.team.event.name}
                  </Badge>
                )}
              </div>
            </div>
            {/* Separate items, so a narrow screen wraps between them. */}
            <p className="flex flex-wrap gap-x-1.5 text-sm text-muted-foreground">
              <span>@{user.username}</span>
              {user.intra && (
                <span>
                  <span aria-hidden>· </span>
                  {user.intra.username} on 42
                </span>
              )}
              <span>
                <span aria-hidden>· </span>
                Playing since {format(new Date(user.createdAt), 'MMMM yyyy')}
              </span>
            </p>
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
          <Button variant="outline" size="sm" asChild>
            <a
              href={`https://github.com/${encodeURIComponent(user.username)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <GithubIcon size={16} />
              GitHub
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={share}>
            <Share2 aria-hidden />
            Share
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <section aria-label="Career" className="rounded-xl border p-3 sm:p-4">
          <h3 className="mb-3 text-lg font-semibold">Career</h3>
          <dl className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
            <Stat
              label="Events"
              value={teams.length}
              detail={`${tournamentEvents} in the tournament`}
            />
            <Stat
              label="Matches"
              value={totalMatches(record)}
              detail={`${record.wins} won · ${record.losses} lost`}
            />
            <Stat
              label="Win rate"
              value={formatPercent(winRate(record))}
              detail={
                summary.form.length >= 5
                  ? `${formatPercent(formWins / summary.form.length)} in the last ${summary.form.length}`
                  : 'Too few matches yet'
              }
            />
            <Stat
              label="Best finish"
              value={
                best ? (
                  <span className="inline-flex items-center gap-1.5">
                    {onPodium && (
                      <Trophy className="size-5 text-amber-500" aria-hidden />
                    )}
                    {placeLabel(best.finish)}
                  </span>
                ) : (
                  '–'
                )
              }
              detail={best ? best.team.event.name : 'No tournament results yet'}
            />
            <Stat
              label="Longest streak"
              // The fifth tile would sit alone in a two-column row.
              className="col-span-2 md:col-span-1"
              value={streaks.longestWin}
              detail={
                streaks.current?.result === 'WIN' && streaks.current.length > 1
                  ? `${streaks.current.length} wins in a row right now`
                  : 'wins in a row'
              }
            />
          </dl>
        </section>
      </CardContent>
    </Card>
  )
}

function Stat({
  label,
  value,
  detail,
  className,
}: {
  label: string
  value: ReactNode
  detail: string
  className?: string
}) {
  return (
    <div className={cn('min-w-0 rounded-lg border p-3', className)}>
      <dt className="text-[0.625rem] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums">{value}</dd>
      <dd className="truncate text-xs text-muted-foreground">{detail}</dd>
    </div>
  )
}
