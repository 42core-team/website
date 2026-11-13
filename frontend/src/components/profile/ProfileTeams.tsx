import type { ReactNode } from 'react'
import type { ProfileTeam, UserProfile } from '@/app/actions/profile'
import { format } from 'date-fns'
import {
  BarChart3,
  Bot,
  ExternalLink,
  Percent,
  Swords,
  Trophy,
} from 'lucide-react'
import Link from '@/components/app-link'
import { GithubIcon } from '@/components/icons'
import {
  TeamCover,
  TeamCoverStripe,
  TeamPicture,
} from '@/components/team/TeamAppearance'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { lifecycleLabels } from '@/lib/event-lifecycle'
import {
  finishLabel,
  formatPercent,
  totalMatches,
  winRate,
} from './profile-stats'

const PODIUM = new Set(['CHAMPION', 'RUNNER_UP', 'THIRD'])

function FinishBadge({ team }: { team: ProfileTeam }) {
  if (team.finish)
    return (
      <Badge variant="outline" className="gap-1">
        {PODIUM.has(team.finish.kind) && (
          <Trophy className="size-3.5 text-amber-500" aria-hidden />
        )}
        {finishLabel(team.finish)}
      </Badge>
    )
  return <Badge variant="secondary">{lifecycleLabels[team.event.state]}</Badge>
}

function TeamCard({ team }: { team: ProfileTeam }) {
  const { record, swissRecord: swiss } = team
  const teamPath = `/events/${team.event.id}/teams/${team.id}`

  return (
    <Card className="gap-0 overflow-hidden pt-0">
      {team.background ? (
        <TeamCover team={team} className="aspect-auto h-20 sm:h-24" />
      ) : (
        <TeamCoverStripe className="sm:h-24" />
      )}
      <CardHeader className="relative -mt-2 flex flex-row items-center gap-3 space-y-0 pt-0 pb-4">
        <div className="shrink-0 rounded-2xl bg-card p-1 shadow-sm">
          <TeamPicture team={team} large className="size-16" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <CardTitle className="min-w-0 truncate text-xl font-bold sm:text-2xl">
              <Link to={teamPath} className="hover:underline">
                {team.name}
              </Link>
            </CardTitle>
            <FinishBadge team={team} />
          </div>
          <p className="truncate text-sm text-muted-foreground">
            <Link
              to={`/events/${team.event.id}`}
              className="hover:text-foreground hover:underline"
            >
              {team.event.name}
            </Link>{' '}
            · {format(new Date(team.event.startDate), 'MMM yyyy')}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="divide-y rounded-xl border p-4">
          <Row icon={Swords} label="Record">
            {totalMatches(record) ? `${record.wins}–${record.losses}` : '–'}
          </Row>
          <Row icon={BarChart3} label="Swiss">
            {totalMatches(swiss) ? `${swiss.wins}–${swiss.losses}` : '–'}
          </Row>
          <Row icon={Percent} label="Win rate">
            {formatPercent(winRate(record))}
          </Row>
          {team.starterTemplate && (
            <Row icon={Bot} label="Bot template">
              {team.starterTemplate}
            </Row>
          )}
        </dl>

        {team.repo && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Repository</p>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="max-w-full gap-2 px-3"
            >
              <a
                href={team.repo.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${team.repo.name} repository on GitHub`}
              >
                <GithubIcon size={14} />
                <span className="truncate">{team.repo.name}</span>
                <ExternalLink
                  className="text-muted-foreground"
                  aria-hidden="true"
                />
              </a>
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap gap-2">
            {team.members.map((member) => (
              <Link
                key={member.id}
                to={`/users/${encodeURIComponent(member.username)}`}
                className="flex min-w-0 items-center gap-2 rounded-lg border py-1 pr-2.5 pl-1 text-sm transition-colors hover:bg-muted"
              >
                <Avatar className="size-6">
                  <AvatarImage
                    src={member.profilePicture ?? undefined}
                    alt=""
                  />
                  <AvatarFallback className="text-[10px]">
                    {member.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{member.name}</span>
              </Link>
            ))}
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link to={teamPath}>View team</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Bot
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </dt>
      <dd className="text-right font-medium tabular-nums">{children}</dd>
    </div>
  )
}

export function ProfileTeams({ profile }: { profile: UserProfile }) {
  if (profile.teams.length === 0)
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/10 py-12 text-center">
        <p className="font-medium text-muted-foreground">No teams yet</p>
      </div>
    )
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {profile.teams.map((team) => (
        <TeamCard key={team.id} team={team} />
      ))}
    </div>
  )
}
