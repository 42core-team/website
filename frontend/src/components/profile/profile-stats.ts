import type {
  BracketFinish,
  MatchRecord,
  ProfileActivity,
  ProfileMatchPhase,
  ProfileTeam,
  ProfileTeamMember,
} from '@/app/actions/profile'

// The names the team page's match history uses.
export const PHASE_LABELS: { [phase in ProfileMatchPhase]: string } = {
  QUEUE: 'Match Making',
  SWISS: 'Swiss',
  ELIMINATION: 'Tournament',
  GAMBLING: 'Gambling',
  MANUAL: 'Manual',
}

export function totalMatches(record: MatchRecord): number {
  return record.wins + record.losses + record.draws
}

/** Share of matches won, 0–1; null without matches. */
export function winRate(record: MatchRecord): number | null {
  const total = totalMatches(record)
  return total ? record.wins / total : null
}

const DAY_MS = 86_400_000

export interface ActivityDay {
  date: Date
  count: number
  /** False for the padding before the window, which stays empty. */
  inRange: boolean
}

function startOfDayUtc(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

/**
 * The activity window in columns of seven days (Sunday to Saturday, UTC),
 * from the week of `since` through the week of `now`.
 */
export function getActivityWeeks(
  activity: ProfileActivity,
  now = new Date(),
): ActivityDay[][] {
  const counts = new Map(activity.days.map((day) => [day.day, day.count]))
  const since = Date.parse(`${activity.since}T00:00:00Z`)
  const today = startOfDayUtc(now)
  const start = since - new Date(since).getUTCDay() * DAY_MS
  const end = today + (6 - new Date(today).getUTCDay()) * DAY_MS
  const weeks = Math.round((end - start) / DAY_MS + 1) / 7
  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (__, weekday) => {
      const time = start + (week * 7 + weekday) * DAY_MS
      const date = new Date(time)
      const inRange = time >= since && time <= today
      return {
        date,
        inRange,
        count: inRange ? (counts.get(date.toISOString().slice(0, 10)) ?? 0) : 0,
      }
    }),
  )
}

/** Formats a UTC day as UTC, so it reads the same in every time zone. */
export function formatUtcDay(
  date: Date,
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  },
): string {
  return date.toLocaleDateString('en-US', { ...options, timeZone: 'UTC' })
}

/**
 * A comparable place: 1 for the champion, 5 for a quarterfinal exit. A lost
 * semifinal whose match for third place is still open ranks below a decided
 * third or fourth place.
 */
export function finishPlace(finish: BracketFinish): number | null {
  switch (finish.kind) {
    case 'CHAMPION':
      return 1
    case 'RUNNER_UP':
      return 2
    case 'THIRD':
      return 3
    case 'FOURTH':
      return 4
    case 'IN_BRACKET':
      return null
    case 'ELIMINATED':
      if (!finish.roundOf) return null
      return finish.roundOf === 4 ? 4.5 : finish.roundOf / 2 + 1
  }
}

export function finishLabel(finish: BracketFinish): string {
  switch (finish.kind) {
    case 'CHAMPION':
      return 'Champion'
    case 'RUNNER_UP':
      return 'Runner-up'
    case 'THIRD':
      return '3rd place'
    case 'FOURTH':
      return '4th place'
    case 'IN_BRACKET':
      return 'In the bracket'
    case 'ELIMINATED':
      if (finish.roundOf === 4) return 'Semifinal'
      if (finish.roundOf === 8) return 'Quarterfinal'
      return finish.roundOf ? `Round of ${finish.roundOf}` : 'Bracket'
  }
}

export function getBestFinish(
  teams: ProfileTeam[],
): { team: ProfileTeam; finish: BracketFinish; place: number } | null {
  let best: { team: ProfileTeam; finish: BracketFinish; place: number } | null =
    null
  for (const team of teams) {
    if (!team.finish) continue
    const place = finishPlace(team.finish)
    if (place === null) continue
    if (!best || place < best.place) best = { team, finish: team.finish, place }
  }
  return best
}

export function getFrequentTeammate(
  teams: ProfileTeam[],
  userId: string,
): { member: ProfileTeamMember; teams: number } | null {
  const counts = new Map<string, { member: ProfileTeamMember; teams: number }>()
  for (const team of teams) {
    for (const member of team.members) {
      if (member.id === userId) continue
      const entry = counts.get(member.id) ?? { member, teams: 0 }
      entry.teams++
      counts.set(member.id, entry)
    }
  }
  let best: { member: ProfileTeamMember; teams: number } | null = null
  for (const entry of counts.values()) {
    if (entry.teams >= 2 && (!best || entry.teams > best.teams)) best = entry
  }
  return best
}

export function formatPercent(rate: number | null): string {
  return rate === null ? '–' : `${Math.round(rate * 1000) / 10}%`
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en', {
    notation: value >= 100_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 100_000 ? 2 : 0,
  }).format(value)
}
