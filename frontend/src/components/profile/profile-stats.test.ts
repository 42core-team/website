import { describe, expect, it } from 'vitest'
import type { ProfileMatch, ProfileTeam } from '@/app/actions/profile'
import {
  finishLabel,
  getActivity,
  getBestFinish,
  getForm,
  getFrequentTeammate,
  getPhaseRecords,
  getRecord,
  getRivals,
  getStreaks,
} from './profile-stats'

let day = 0
function match(
  result: ProfileMatch['result'],
  overrides: Partial<ProfileMatch> = {},
): ProfileMatch {
  day++
  return {
    id: null,
    teamId: 't1',
    eventId: 'e1',
    phase: 'QUEUE',
    round: 0,
    createdAt: new Date(Date.UTC(2026, 0, day)).toISOString(),
    result,
    opponent: null,
    stats: null,
    ...overrides,
  }
}

function opponent(id: string) {
  return { id, name: id, deletedAt: null, picture: null, background: null }
}

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
      bracketSize: null,
    },
    members: [],
    finish: null,
    ...overrides,
  }
}

describe('getRecord', () => {
  it('counts results and the win rate', () => {
    expect(
      getRecord([match('WIN'), match('LOSS'), match('WIN'), match('DRAW')]),
    ).toEqual({
      wins: 2,
      losses: 1,
      draws: 1,
      total: 4,
      winRate: 0.5,
    })
    expect(getRecord([]).winRate).toBeNull()
  })
})

describe('getForm and getStreaks', () => {
  it('orders form oldest first and finds streaks regardless of input order', () => {
    const matches = [
      match('WIN'),
      match('WIN'),
      match('WIN'),
      match('LOSS'),
      match('WIN'),
      match('WIN'),
    ].reverse()
    expect(getForm(matches, 3).map((m) => m.result)).toEqual([
      'LOSS',
      'WIN',
      'WIN',
    ])
    expect(getStreaks(matches)).toEqual({
      longestWin: 3,
      current: { result: 'WIN', length: 2 },
    })
  })
})

describe('getPhaseRecords', () => {
  it('lists only phases with matches, in a fixed order', () => {
    const rows = getPhaseRecords([
      match('WIN', { phase: 'SWISS' }),
      match('LOSS', { phase: 'QUEUE' }),
    ])
    expect(rows.map((row) => [row.label, row.wins, row.losses])).toEqual([
      ['Match Making', 0, 1],
      ['Swiss', 1, 0],
    ])
  })
})

describe('getActivity', () => {
  it('buckets matches by UTC day into whole weeks ending this week', () => {
    const now = new Date(Date.UTC(2026, 10, 13, 12)) // Friday
    const weeks = getActivity(
      [
        match('WIN', { createdAt: '2026-11-13T08:00:00Z' }),
        match('LOSS', { createdAt: '2026-11-13T20:00:00Z' }),
        match('WIN', { createdAt: '2025-01-01T00:00:00Z' }),
      ],
      2,
      now,
    )
    expect(weeks).toHaveLength(2)
    expect(weeks[1][6].date.toISOString()).toBe('2026-11-14T00:00:00.000Z')
    expect(weeks[1][5]).toMatchObject({ count: 2 })
    expect(weeks.flat().reduce((sum, d) => sum + d.count, 0)).toBe(2)
  })
})

describe('getRivals', () => {
  it('needs two meetings and breaks ties by total matches', () => {
    const a = opponent('a')
    const b = opponent('b')
    const rivals = getRivals([
      match('LOSS', { opponent: a }),
      match('LOSS', { opponent: a }),
      match('WIN', { opponent: a }),
      match('WIN', { opponent: b }),
      match('WIN', { opponent: b }),
      match('WIN', { opponent: b }),
    ])
    expect(rivals.nemesis?.team.id).toBe('a')
    expect(rivals.favourite?.team.id).toBe('b')
    expect(rivals.mostPlayed?.total).toBe(3)
    expect(getRivals([match('LOSS', { opponent: a })]).nemesis).toBeNull()
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
