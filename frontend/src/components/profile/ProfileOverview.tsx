import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { ProfileSummary, UserProfile } from '@/app/actions/profile'
import { format } from 'date-fns'
import {
  Activity,
  BarChart3,
  BrickWall,
  CalendarDays,
  Crosshair,
  Flame,
  Footprints,
  Gem,
  Swords,
  Trophy,
  Users,
} from 'lucide-react'
import Link from '@/components/app-link'
import { TeamPicture } from '@/components/team/TeamAppearance'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  PHASE_LABELS,
  formatCompact,
  formatPercent,
  formatUtcDay,
  getActivityWeeks,
  getFrequentTeammate,
  totalMatches,
  winRate,
} from './profile-stats'
import { ResultPill } from './ResultPill'

/** A card with the icon-and-title header of the team match history. */
export function Panel({
  icon: Icon,
  title,
  aside,
  className,
  children,
}: {
  icon: LucideIcon
  title: string
  aside?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={cn('overflow-hidden border shadow-sm', className)}>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 border-b bg-muted/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <Icon className="size-5 text-muted-foreground" aria-hidden />
          <h3 className="text-xl font-semibold text-foreground">{title}</h3>
        </div>
        {aside && (
          <span className="text-sm text-muted-foreground">{aside}</span>
        )}
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  )
}

/** An icon, label and value row, as in the event overview's facts. */
function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon?: LucideIcon
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className="size-4" aria-hidden="true" />}
        {label}
      </dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  )
}

export function ProfileOverview({ profile }: { profile: UserProfile }) {
  const { summary } = profile
  if (totalMatches(summary.record) === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/10 py-12 text-center">
        <p className="font-medium text-muted-foreground">
          No finished matches yet
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          icon={Activity}
          title="Form"
          aside={`Last ${summary.form.length} matches, oldest first`}
          className="lg:col-span-2"
        >
          <FormStrip form={summary.form} />
          <WinRateByEvent profile={profile} />
        </Panel>
        <RecordPanel summary={summary} />
      </div>
      <ActivityPanel activity={summary.activity} />
      <div className="grid gap-6 lg:grid-cols-3">
        <RivalsPanel profile={profile} />
        <CombatPanel profile={profile} />
      </div>
    </div>
  )
}

function FormStrip({ form }: { form: ProfileSummary['form'] }) {
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Recent results">
      {form.map((match, index) => (
        <li key={`${match.createdAt}-${index}`}>
          <ResultPill
            result={match.result}
            title={`${match.opponent ? `against ${match.opponent}, ` : ''}${format(new Date(match.createdAt), 'MMM d, yyyy')}`}
          />
        </li>
      ))}
    </ol>
  )
}

function WinRateByEvent({ profile }: { profile: UserProfile }) {
  const rows = [...profile.teams]
    .reverse()
    .filter((team) => totalMatches(team.record) > 0)
    .slice(-8)
  if (rows.length < 2) return null
  const columns = {
    gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`,
  }

  return (
    <div className="mt-6 border-t pt-5">
      <p className="mb-4 text-sm text-muted-foreground">Win rate by event</p>
      <div className="grid h-40 items-end gap-3 border-b" style={columns}>
        {rows.map((team) => {
          const rate = winRate(team.record)
          return (
            <div
              key={team.id}
              className="flex h-full flex-col items-center justify-end gap-1.5"
            >
              <span className="text-sm font-medium tabular-nums">
                {formatPercent(rate)}
              </span>
              <div
                className="w-full max-w-14 rounded-t-md bg-primary/80"
                style={{ height: `${Math.max(4, (rate ?? 0) * 120)}px` }}
                aria-hidden
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 grid gap-3" style={columns}>
        {rows.map((team) => (
          <div key={team.id} className="min-w-0 text-center">
            <p className="truncate text-xs font-medium">{team.event.name}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {team.record.wins}–{team.record.losses}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecordPanel({ summary }: { summary: ProfileSummary }) {
  const { record } = summary
  const rate = winRate(record) ?? 0
  const radius = 42
  const circumference = 2 * Math.PI * radius

  return (
    <Panel icon={BarChart3} title="Record">
      <div className="mb-5 flex items-center gap-5">
        <div className="relative size-28 shrink-0">
          <svg
            viewBox="0 0 100 100"
            className="size-full -rotate-90"
            role="img"
            aria-label={`${formatPercent(rate)} of matches won`}
          >
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              strokeWidth="10"
              className="stroke-muted"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              strokeWidth="10"
              strokeDasharray={`${rate * circumference} ${circumference}`}
              className="stroke-emerald-500"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xl font-bold tabular-nums">
            {Math.round(rate * 100)}%
          </span>
        </div>
        <div className="space-y-1 text-sm">
          <p>
            <span className="font-semibold">{record.wins}</span>{' '}
            <span className="text-muted-foreground">won</span>
          </p>
          <p>
            <span className="font-semibold">{record.losses}</span>{' '}
            <span className="text-muted-foreground">lost</span>
          </p>
          {record.draws > 0 && (
            <p>
              <span className="font-semibold">{record.draws}</span>{' '}
              <span className="text-muted-foreground">tied</span>
            </p>
          )}
        </div>
      </div>
      <dl className="divide-y border-t pt-3">
        {summary.phases.map((phase) => (
          <Fact
            key={phase.phase}
            label={PHASE_LABELS[phase.phase]}
            value={
              <>
                {phase.wins}–{phase.losses}
                <span className="ml-2 text-muted-foreground">
                  {formatPercent(winRate(phase))}
                </span>
              </>
            }
          />
        ))}
      </dl>
    </Panel>
  )
}

const HEAT_LEVELS = [
  'bg-muted',
  'bg-primary/25',
  'bg-primary/50',
  'bg-primary/75',
  'bg-primary',
]

function heatLevel(count: number, max: number) {
  if (count === 0) return 0
  return Math.min(4, Math.max(1, Math.ceil((count / max) * 4)))
}

function ActivityPanel({ activity }: { activity: ProfileSummary['activity'] }) {
  const weeks = getActivityWeeks(activity)
  const total = activity.days.reduce((sum, day) => sum + day.count, 0)
  const busiest = activity.days.reduce<
    ProfileSummary['activity']['days'][number] | null
  >((best, day) => (!best || day.count > best.count ? day : best), null)
  const max = Math.max(1, busiest?.count ?? 0)
  // Days are UTC days, so their labels are written in UTC too.
  const monthLabels = weeks.map((week, index) => {
    const month = week[0].date.getUTCMonth()
    const previous = index > 0 ? weeks[index - 1][0].date.getUTCMonth() : -1
    return month !== previous && index < weeks.length - 2
      ? formatUtcDay(week[0].date, { month: 'short' })
      : ''
  })
  const description =
    total === 0
      ? 'No matches in the last 12 months.'
      : `${total} ${total === 1 ? 'match' : 'matches'} on ${activity.days.length} ${activity.days.length === 1 ? 'day' : 'days'} in the last 12 months. Busiest day: ${formatUtcDay(new Date(`${busiest!.day}T00:00:00Z`))} with ${busiest!.count} ${busiest!.count === 1 ? 'match' : 'matches'}.`

  return (
    <Panel
      icon={CalendarDays}
      title="Activity"
      aside={
        total === 0
          ? 'No matches in the last 12 months'
          : `${total} matches in the last 12 months`
      }
    >
      {/* rtl keeps the scroll position at the newest weeks on narrow screens. */}
      <div dir="rtl" className="overflow-x-auto pb-1">
        {/* The text below describes the grid; hovering a day shows its count. */}
        <div
          dir="ltr"
          aria-hidden
          className="grid min-w-[44rem] grid-flow-col gap-[3px]"
          style={{
            gridTemplateColumns: `2rem repeat(${weeks.length}, minmax(0, 1fr))`,
            gridTemplateRows: 'auto repeat(7, auto)',
          }}
        >
          {['', '', 'Mon', '', 'Wed', '', 'Fri', ''].map((label, index) => (
            <span
              key={index}
              className="self-center text-[10px] leading-none text-muted-foreground"
            >
              {label}
            </span>
          ))}
          {weeks.map((week, index) => [
            <span
              key={`${week[0].date.toISOString()}-label`}
              className="h-3.5 overflow-visible text-[10px] leading-3 whitespace-nowrap text-muted-foreground"
            >
              {monthLabels[index]}
            </span>,
            ...week.map((day) =>
              day.inRange ? (
                <span
                  key={day.date.toISOString()}
                  title={`${day.count === 0 ? 'No' : day.count} ${day.count === 1 ? 'match' : 'matches'} on ${formatUtcDay(day.date)}`}
                  className={cn(
                    'aspect-square w-full max-w-5 rounded-[3px]',
                    HEAT_LEVELS[heatLevel(day.count, max)],
                  )}
                />
              ) : (
                <span
                  key={day.date.toISOString()}
                  className="aspect-square w-full max-w-5"
                />
              ),
            ),
          ])}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>{description}</p>
        <span className="flex items-center gap-1.5" aria-hidden>
          Less
          {HEAT_LEVELS.map((level) => (
            <span key={level} className={cn('size-3 rounded-[3px]', level)} />
          ))}
          More
        </span>
      </div>
    </Panel>
  )
}

function CombatPanel({ profile }: { profile: UserProfile }) {
  const { combat } = profile
  const rows: Array<{ icon: LucideIcon; label: string; value: number }> = [
    { icon: Users, label: 'Units spawned', value: combat.unitsSpawned },
    { icon: Flame, label: 'Damage dealt', value: combat.damageTotal },
    { icon: Crosshair, label: 'Cores destroyed', value: combat.coresDestroyed },
    { icon: Gem, label: 'Gems gained', value: combat.gemsGained },
    { icon: BrickWall, label: 'Walls destroyed', value: combat.wallsDestroyed },
    { icon: Footprints, label: 'Tiles traveled', value: combat.tilesTraveled },
  ]
  return (
    <Panel icon={Swords} title="On the battlefield">
      <dl className="divide-y">
        {rows.map((row) => (
          <Fact
            key={row.label}
            icon={row.icon}
            label={row.label}
            value={formatCompact(row.value)}
          />
        ))}
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">
        Both sides of all {combat.matches} matches together.
      </p>
    </Panel>
  )
}

function RivalsPanel({ profile }: { profile: UserProfile }) {
  const { rivals } = profile.summary
  const teammate = getFrequentTeammate(profile.teams, profile.user.id)
  const rows = [
    rivals.nemesis && {
      kind: 'Nemesis',
      rival: rivals.nemesis,
      detail: `Won ${rivals.nemesis.losses} of ${rivals.nemesis.total} meetings`,
    },
    rivals.favourite && {
      kind: 'Favourite opponent',
      rival: rivals.favourite,
      detail: `Lost ${rivals.favourite.wins} of ${rivals.favourite.total} meetings`,
    },
    rivals.mostPlayed &&
      rivals.mostPlayed.team.id !== rivals.nemesis?.team.id &&
      rivals.mostPlayed.team.id !== rivals.favourite?.team.id && {
        kind: 'Most played',
        rival: rivals.mostPlayed,
        detail: `${rivals.mostPlayed.total} matches, ${rivals.mostPlayed.wins}–${rivals.mostPlayed.losses}`,
      },
  ].filter((row) => !!row)

  return (
    <Panel icon={Trophy} title="Rivals" className="lg:col-span-2">
      {rows.length === 0 && !teammate ? (
        <p className="text-sm text-muted-foreground">
          Rivals show up after meeting a team twice.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map(({ kind, rival, detail }) => (
            <Link
              key={kind}
              to={`/events/${rival.eventId}/teams/${rival.team.id}`}
              className="flex min-w-0 items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
            >
              <TeamPicture
                team={rival.team}
                className="size-10 rounded-md"
                fallbackClassName="rounded-md bg-muted text-xs text-muted-foreground"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[0.625rem] font-semibold tracking-wider text-muted-foreground uppercase">
                  {kind}
                </p>
                <p className="truncate font-semibold">{rival.team.name}</p>
                <p className="text-xs text-muted-foreground">{detail}</p>
              </div>
            </Link>
          ))}
          {teammate && (
            <Link
              to={`/users/${encodeURIComponent(teammate.member.username)}`}
              className="flex min-w-0 items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
            >
              <Avatar className="size-10 shrink-0">
                <AvatarImage
                  src={teammate.member.profilePicture ?? undefined}
                  alt=""
                />
                <AvatarFallback>
                  {teammate.member.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-[0.625rem] font-semibold tracking-wider text-muted-foreground uppercase">
                  Go-to teammate
                </p>
                <p className="truncate font-semibold">{teammate.member.name}</p>
                <p className="text-xs text-muted-foreground">
                  Teamed up in {teammate.teams} events
                </p>
              </div>
            </Link>
          )}
        </div>
      )}
    </Panel>
  )
}
