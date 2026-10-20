import { describe, expect, it } from 'vitest'
import type { Team } from '@/app/actions/team'
import type { MomentEvent } from './event-moment'
import { eventTabs } from './event-tabs'

type TabTeam = Pick<Team, 'locked' | 'repositoryStatus'>

const start = Date.parse('2026-10-16T09:00:00Z')
const deadline = Date.parse('2026-10-17T18:00:00Z')
const event: MomentEvent & { gamblingEnabled: boolean } = {
  id: 'e1',
  state: 'REGISTRATION',
  startDate: new Date(start).toISOString(),
  submissionDeadline: new Date(deadline).toISOString(),
  isPrivate: false,
  introEnabled: false,
  introLeadMinutes: 15,
  streamUrl: null,
  showtimeStreamUrl: null,
  gamblingEnabled: true,
}

describe('eventTabs', () => {
  const base = {
    event,
    isRegistered: true,
    team: { locked: false, repositoryStatus: 'READY' } as TabTeam | null,
    isAdmin: false,
    supportsUnitBuilder: false,
    formatTime: () => '09:00',
  }
  const names = (tabs: { name: string }[]) => tabs.map((t) => t.name)

  it('shows every tab but Dashboard and locks tools before coding', () => {
    const tabs = eventTabs({ ...base, now: start - 1 })
    expect(names(tabs)).toEqual([
      'Info',
      'Teams',
      'My Team',
      'Unit Builder',
      'Match Making',
      'Gambling',
      'Group Phase',
      'Tournament Tree',
    ])
    expect(tabs.find((t) => t.name === 'Match Making')).toMatchObject({
      lockedReason: 'Opens 09:00',
      disabled: true,
    })
    expect(tabs.find((t) => t.name === 'Unit Builder')).toMatchObject({
      lockedReason: 'Not used in this event',
      disabled: true,
    })
  })

  it('locks team tools for viewers without making them clickable', () => {
    const tab = (isRegistered: boolean, name: string) =>
      eventTabs({ ...base, isRegistered, team: null, now: start + 1 }).find(
        (t) => t.name === name,
      )
    expect(tab(true, 'Match Making')).toMatchObject({
      lockedReason: 'Join a team first',
      disabled: true,
    })
    expect(tab(false, 'Gambling')).toMatchObject({
      lockedReason: 'Join the event first',
      disabled: true,
    })
    expect(tab(false, 'My Team')).toMatchObject({ disabled: true })
    expect(tab(true, 'My Team')?.lockedReason).toBeUndefined()
  })

  it('unlocks during coding and keeps closed tools readable afterwards', () => {
    const tab = (now: number, name: string) =>
      eventTabs({ ...base, now }).find((t) => t.name === name)
    expect(tab(start + 1, 'Match Making')?.lockedReason).toBeUndefined()
    for (const name of ['Match Making', 'Gambling'])
      expect(tab(deadline, name)).toEqual(
        expect.objectContaining({ lockedReason: 'Closed' }),
      )
    expect(tab(deadline, 'Gambling')?.disabled).toBeUndefined()
  })

  it('marks My Team read only once the team can no longer change', () => {
    const myTeam = (now: number, team: TabTeam | null) =>
      eventTabs({ ...base, team, now }).find((t) => t.name === 'My Team')
    expect(myTeam(start + 1, base.team)?.lockedReason).toBeUndefined()
    expect(myTeam(deadline, base.team)).toMatchObject({
      lockedReason: 'Read only',
    })
    expect(myTeam(deadline, base.team)?.disabled).toBeUndefined()
    expect(
      myTeam(start + 1, { locked: true, repositoryStatus: 'LOCKED' }),
    ).toMatchObject({ lockedReason: 'Read only' })
  })

  it('disables My Team for teamless members once team creation has closed', () => {
    expect(
      eventTabs({ ...base, team: null, now: start + 1 }).find(
        (t) => t.name === 'My Team',
      )?.lockedReason,
    ).toBeUndefined()
    expect(
      eventTabs({ ...base, team: null, now: deadline }).find(
        (t) => t.name === 'My Team',
      ),
    ).toMatchObject({ lockedReason: 'Closed', disabled: true })
  })

  it('groups tabs in journey order with admin last', () => {
    const tabs = eventTabs({
      ...base,
      isAdmin: true,
      supportsUnitBuilder: true,
      now: deadline,
    })
    expect(tabs.map((t) => `${t.group}:${t.name}`)).toEqual([
      'info:Info',
      'teams:Teams',
      'team:My Team',
      'team:Unit Builder',
      'team:Match Making',
      'team:Gambling',
      'tournament:Group Phase',
      'tournament:Tournament Tree',
      'admin:Dashboard',
    ])
  })

  it('opens tournament tabs from code freeze on, and always to admins', () => {
    const groups = (now: number, isAdmin = false) =>
      eventTabs({ ...base, isAdmin, now }).find((t) => t.name === 'Group Phase')
    expect(groups(start + 1)).toMatchObject({
      lockedReason: 'Opens 09:00',
      disabled: true,
    })
    expect(groups(deadline)?.lockedReason).toBeUndefined()
    expect(groups(start + 1, true)?.lockedReason).toBeUndefined()
  })
})
