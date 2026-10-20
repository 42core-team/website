import { describe, expect, it } from 'vitest'
import type { MomentEvent } from './event-moment'
import { eventTabs } from './event-tabs'

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
  gamblingEnabled: true,
}

describe('eventTabs', () => {
  const base = {
    event,
    isRegistered: true,
    hasTeam: true,
    isAdmin: false,
    supportsUnitBuilder: false,
    formatTime: () => '09:00',
  }
  const names = (tabs: { name: string }[]) => tabs.map((t) => t.name)

  it('keeps participant tools visible but locked before coding', () => {
    const tabs = eventTabs({ ...base, now: start - 1 })
    expect(names(tabs)).toEqual([
      'Info',
      'My Team',
      'Match Making',
      'Teams',
      'Gambling',
    ])
    expect(tabs.find((t) => t.name === 'Match Making')?.lockedReason).toBe(
      'Opens 09:00',
    )
  })

  it('unlocks during coding and marks tools closed afterwards', () => {
    expect(
      eventTabs({ ...base, now: start + 1 }).find(
        (t) => t.name === 'Match Making',
      )?.lockedReason,
    ).toBeUndefined()
    expect(
      eventTabs({ ...base, now: deadline }).find((t) => t.name === 'Gambling')
        ?.lockedReason,
    ).toBe('Closed')
  })

  it('groups tabs in journey order with admin last', () => {
    const tabs = eventTabs({ ...base, isAdmin: true, now: deadline })
    expect(tabs.map((t) => `${t.group}:${t.name}`)).toEqual([
      'team:Info',
      'team:My Team',
      'team:Match Making',
      'event:Teams',
      'event:Group Phase',
      'event:Tournament Tree',
      'event:Gambling',
      'admin:Dashboard',
    ])
  })

  it('shows tournament tabs from coding closed on, and always to admins', () => {
    expect(names(eventTabs({ ...base, now: start + 1 }))).not.toContain(
      'Group Phase',
    )
    expect(names(eventTabs({ ...base, now: deadline }))).toContain(
      'Tournament Tree',
    )
    expect(
      names(eventTabs({ ...base, isAdmin: true, now: start + 1 })),
    ).toEqual(
      expect.arrayContaining(['Group Phase', 'Tournament Tree', 'Dashboard']),
    )
  })
})
