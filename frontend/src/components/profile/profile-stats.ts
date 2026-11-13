import type {
  BracketFinish,
  ProfileMatch,
  ProfileMatchPhase,
  ProfileMatchResult,
  ProfileTeam,
  ProfileTeamMember,
} from '@/app/actions/profile'

export interface MatchRecord {
  wins: number
  losses: number
  draws: number
  total: number
  /** Share of matches won, 0–1; null without matches. */
  winRate: number | null
}

export function getRecord(matches: ProfileMatch[]): MatchRecord {
  let wins = 0
  let losses = 0
  let draws = 0
  for (const match of matches) {
    if (match.result === 'WIN') wins++
    else if (match.result === 'LOSS') losses++
    else draws++
  }
  const total = wins + losses + draws
  return { wins, losses, draws, total, winRate: total ? wins / total : null }
}

function oldestFirst(matches: ProfileMatch[]) {
  return [...matches].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
}

/** The latest `count` matches, oldest first. */
export function getForm(matches: ProfileMatch[], count = 20): ProfileMatch[] {
  return oldestFirst(matches).slice(-count)
}

export interface Streaks {
  longestWin: number
  current: { result: ProfileMatchResult; length: number } | null
}

export function getStreaks(matches: ProfileMatch[]): Streaks {
  let longestWin = 0
  let run = 0
  let current = null as Streaks['current']
  for (const match of oldestFirst(matches)) {
    run = match.result === 'WIN' ? run + 1 : 0
    longestWin = Math.max(longestWin, run)
    current =
      current?.result === match.result
        ? { result: match.result, length: current.length + 1 }
        : { result: match.result, length: 1 }
  }
  return { longestWin, current }
}

// The names the team page's match history uses.
export const PHASE_LABELS: { [phase in ProfileMatchPhase]: string } = {
  QUEUE: 'Match Making',
  SWISS: 'Swiss',
  ELIMINATION: 'Tournament',
  GAMBLING: 'Gambling',
  MANUAL: 'Manual',
}

const PHASE_ORDER: ProfileMatchPhase[] = [
  'QUEUE',
  'SWISS',
  'ELIMINATION',
  'GAMBLING',
  'MANUAL',
]

export function getPhaseRecords(
  matches: ProfileMatch[],
): Array<{ phase: ProfileMatchPhase; label: string } & MatchRecord> {
  return PHASE_ORDER.map((phase) => ({
    phase,
    label: PHASE_LABELS[phase],
    ...getRecord(matches.filter((match) => match.phase === phase)),
  })).filter((row) => row.total > 0)
}

export interface ActivityDay {
  date: Date
  count: number
}

function startOfDayUtc(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
}

const DAY_MS = 86_400_000

/**
 * Matches per day for the last `weeks` weeks, in columns of seven days
 * (Sunday to Saturday, UTC) ending with the week of `now`.
 */
export function getActivity(
  matches: ProfileMatch[],
  weeks: number,
  now = new Date(),
): ActivityDay[][] {
  const today = startOfDayUtc(now)
  const end = new Date(today.getTime() + (6 - today.getUTCDay()) * DAY_MS)
  const start = new Date(end.getTime() - (weeks * 7 - 1) * DAY_MS)
  const counts = new Map<number, number>()
  for (const match of matches) {
    const day = startOfDayUtc(new Date(match.createdAt)).getTime()
    if (day < start.getTime() || day > end.getTime()) continue
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (__, weekday) => {
      const date = new Date(start.getTime() + (week * 7 + weekday) * DAY_MS)
      return { date, count: counts.get(date.getTime()) ?? 0 }
    }),
  )
}

export interface Rival {
  team: NonNullable<ProfileMatch['opponent']>
  eventId: string
  wins: number
  losses: number
  total: number
}

export interface Rivals {
  /** Beat the player most often. */
  nemesis: Rival | null
  /** Lost to the player most often. */
  favourite: Rival | null
  mostPlayed: Rival | null
}

export function getRivals(matches: ProfileMatch[]): Rivals {
  const byOpponent = new Map<string, Rival>()
  for (const match of matches) {
    if (!match.opponent) continue
    const rival = byOpponent.get(match.opponent.id) ?? {
      team: match.opponent,
      eventId: match.eventId,
      wins: 0,
      losses: 0,
      total: 0,
    }
    rival.total++
    if (match.result === 'WIN') rival.wins++
    if (match.result === 'LOSS') rival.losses++
    byOpponent.set(match.opponent.id, rival)
  }
  const rivals = [...byOpponent.values()]
  const top = (score: (rival: Rival) => number, minimum: number) => {
    let best: Rival | null = null
    for (const rival of rivals) {
      if (score(rival) < minimum) continue
      if (
        !best ||
        score(rival) > score(best) ||
        (score(rival) === score(best) && rival.total > best.total)
      )
        best = rival
    }
    return best
  }
  return {
    nemesis: top((rival) => rival.losses, 2),
    favourite: top((rival) => rival.wins, 2),
    mostPlayed: top((rival) => rival.total, 2),
  }
}

const FINISH_RANK: { [kind in BracketFinish['kind']]: number } = {
  CHAMPION: 1,
  RUNNER_UP: 2,
  THIRD: 3,
  FOURTH: 4,
  ELIMINATED: 5,
  IN_BRACKET: 99,
}

/** A comparable place: 1 for the champion, 5 for a quarterfinal exit. */
export function finishPlace(finish: BracketFinish): number | null {
  if (finish.kind === 'IN_BRACKET') return null
  if (finish.kind === 'ELIMINATED')
    return finish.roundOf ? finish.roundOf / 2 + 1 : null
  return FINISH_RANK[finish.kind]
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
