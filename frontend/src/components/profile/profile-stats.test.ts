import { describe, expect, it } from 'vitest'
import type { ProfileTeam } from '@/app/actions/profile'
import {
  finishLabel,
  formatUtcDay,
  getActivityWeeks,
  getBestFinish,
  getFrequentTeammate,
  winRate,
} from './profile-stats'

function team(overrides: Partial<ProfileTeam>): ProfileTeam {
  return {
    id: 't',
    name: 'Team',
    picture: null,
    background: null,
    repo: null,
    starterTemplate: null,
    createdAt: '2026-01-01T00:00:00Z',
    event: {
      id: 'e',
      name: 'Event',
      state: 'COMPLETED',
      startDate: '2026-01-01T00:00:00Z',
      scheduledEndDate: '2026-01-02T00:00:00Z',
    },
    members: [],
    record: { wins: 0, losses: 0, draws: 0 },
    swissRecord: { wins: 0, losses: 0, draws: 0 },
    finish: null,
    ...overrides,
  }
}

describe('winRate', () => {
  it('is the share of matches won, and null without matches', () => {
    expect(winRate({ wins: 2, losses: 1, draws: 1 })).toBe(0.5)
    expect(winRate({ wins: 0, losses: 0, draws: 0 })).toBeNull()
  })
})

describe('getActivityWeeks', () => {
  const now = new Date(Date.UTC(2026, 10, 13, 12)) // Friday

  it('lays the window out in whole UTC weeks ending this week', () => {
    const weeks = getActivityWeeks(
      {
        since: '2026-11-03', // Tuesday
        days: [
          { day: '2026-11-03', count: 1 },
          { day: '2026-11-13', count: 2 },
        ],
      },
      now,
    )
    expect(weeks).toHaveLength(2)
    expect(weeks[0][0].date.toISOString()).toBe('2026-11-01T00:00:00.000Z')
    expect(weeks[1][6].date.toISOString()).toBe('2026-11-14T00:00:00.000Z')
    expect(weeks[1][5]).toMatchObject({ count: 2, inRange: true })
    expect(weeks.flat().reduce((sum, day) => sum + day.count, 0)).toBe(3)
  })

  it('leaves the padding before the window and after today empty', () => {
    const weeks = getActivityWeeks(
      { since: '2026-11-03', days: [{ day: '2026-11-02', count: 5 }] },
      now,
    )
    // Sunday and Monday come before the window, Saturday after today.
    expect(weeks[0][0].inRange).toBe(false)
    expect(weeks[0][1]).toMatchObject({ inRange: false, count: 0 })
    expect(weeks[0][2].inRange).toBe(true)
    expect(weeks[1][6].inRange).toBe(false)
  })
})

describe('formatUtcDay', () => {
  it('names the UTC day in every time zone', () => {
    // Midnight UTC is still the evening before west of UTC.
    expect(formatUtcDay(new Date('2026-11-01T00:00:00Z'))).toBe('Nov 1, 2026')
    expect(
      formatUtcDay(new Date('2026-11-01T00:00:00Z'), { month: 'short' }),
    ).toBe('Nov')
  })
})

describe('finishes', () => {
  it('labels bracket finishes', () => {
    expect(finishLabel({ kind: 'ELIMINATED', roundOf: 8 })).toBe('Quarterfinal')
    expect(finishLabel({ kind: 'ELIMINATED', roundOf: 16 })).toBe('Round of 16')
    expect(finishLabel({ kind: 'THIRD', roundOf: 4 })).toBe('3rd place')
  })

  it('picks the best finish and skips running brackets', () => {
    const best = getBestFinish([
      team({ id: 'qf', finish: { kind: 'ELIMINATED', roundOf: 8 } }),
      team({ id: 'live', finish: { kind: 'IN_BRACKET', roundOf: null } }),
      team({ id: 'third', finish: { kind: 'THIRD', roundOf: 4 } }),
    ])
    expect(best?.team.id).toBe('third')
    expect(getBestFinish([team({})])).toBeNull()
  })

  it('ranks an open semifinal below a decided third place', () => {
    // Newest team first, as the API sends them.
    const best = getBestFinish([
      team({ id: 'open-semi', finish: { kind: 'ELIMINATED', roundOf: 4 } }),
      team({ id: 'third', finish: { kind: 'THIRD', roundOf: 4 } }),
    ])
    expect(best?.team.id).toBe('third')
  })
})

describe('getFrequentTeammate', () => {
  it('finds a teammate shared across at least two teams', () => {
    const me = { id: 'me', username: 'me', name: 'Me', profilePicture: null }
    const lk = { id: 'lk', username: 'lk', name: 'LK', profilePicture: null }
    const once = { id: 'x', username: 'x', name: 'X', profilePicture: null }
    expect(
      getFrequentTeammate(
        [team({ members: [me, lk] }), team({ members: [me, lk, once] })],
        'me',
      ),
    ).toEqual({ member: lk, teams: 2 })
    expect(
      getFrequentTeammate([team({ members: [me, once] })], 'me'),
    ).toBeNull()
  })
})
