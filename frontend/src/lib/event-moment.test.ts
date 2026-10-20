import { describe, expect, it } from 'vitest'
import { eventMoment, eventTabs, formatCountdown } from './event-moment'
import type { MomentEvent, MomentViewer } from './event-moment'

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

const spectator: MomentViewer = { isRegistered: false, team: null }
const noTeam: MomentViewer = { isRegistered: true, team: null }
const member = (
  repositoryStatus: NonNullable<MomentViewer['team']>['repositoryStatus'],
): MomentViewer => ({ isRegistered: true, team: { repositoryStatus } })

const labels = (actions: { label: string }[]) => actions.map((a) => a.label)

describe('eventMoment', () => {
  it('counts down to coding during registration', () => {
    const moment = eventMoment(event, member('PENDING'), { now: start - 1 })
    expect(moment).toMatchObject({
      phase: 'REGISTRATION',
      headline: 'Coding starts in',
      countdownTo: event.startDate,
      showStrip: false,
    })
  })

  it('offers joining only to unregistered viewers of private events', () => {
    const priv = { ...event, isPrivate: true }
    expect(
      labels(eventMoment(priv, spectator, { now: start - 1 }).actions),
    ).toEqual(['Join event'])
    expect(eventMoment(event, spectator, { now: start - 1 }).actions).toEqual(
      [],
    )
  })

  it('sends registered viewers without a team to My Team', () => {
    const moment = eventMoment(event, noTeam, { now: start + 1 })
    expect(moment.description).toMatch(/create a team or join one/)
    expect(labels(moment.actions)).toEqual(['My team'])
    expect(moment.showStrip).toBe(true)
  })

  it('stays quiet during steady-state coding with a ready repository', () => {
    const moment = eventMoment(event, member('READY'), { now: start + 1 })
    expect(moment).toMatchObject({
      headline: 'Coding ends in',
      tone: 'active',
      showStrip: false,
    })
    expect(labels(moment.actions)).toEqual(['Match Making'])
  })

  it('warns in the final three hours of coding', () => {
    const moment = eventMoment(event, member('READY'), {
      now: deadline - 60 * 60 * 1000,
    })
    expect(moment).toMatchObject({ tone: 'warning', showStrip: true })
  })

  it('lets a failed repository override the headline but keeps the deadline countdown', () => {
    const moment = eventMoment(event, member('FAILED'), { now: start + 1 })
    expect(moment).toMatchObject({
      tone: 'danger',
      headline: 'Repository setup failed',
      countdownLabel: 'Coding ends in',
      showStrip: true,
    })
  })

  it('closes coding at the deadline even before the server transition', () => {
    const moment = eventMoment(event, member('LOCKING'), { now: deadline })
    expect(moment).toMatchObject({
      phase: 'SUBMISSIONS_CLOSED',
      countdownTo: null,
      showStrip: true,
    })
  })

  it('points Showtime to the stream and the active tournament view', () => {
    const live = {
      ...event,
      state: 'SHOWCASE' as const,
      streamUrl: 'https://s',
    }
    expect(labels(eventMoment(live, spectator).actions)).toEqual([
      'Watch stream',
      'Group Phase',
    ])
    expect(
      labels(
        eventMoment(live, spectator, { tournamentStage: 'bracket' }).actions,
      ),
    ).toEqual(['Watch stream', 'Tournament Tree'])
    expect(
      labels(eventMoment({ ...live, streamUrl: null }, spectator).actions),
    ).toEqual(['Group Phase'])
  })

  it('has no call to action or strip once completed', () => {
    const moment = eventMoment(
      { ...event, state: 'COMPLETED' },
      member('LOCKED'),
    )
    expect(moment).toMatchObject({ actions: [], showStrip: false })
  })

  it('offers the intro stream shortly before the intro', () => {
    const withIntro = { ...event, introEnabled: true, streamUrl: 'https://s' }
    const intro = start - 15 * 60_000
    expect(
      eventMoment(withIntro, spectator, { now: intro - 2 * 3_600_000 }).actions,
    ).toEqual([])
    expect(
      labels(eventMoment(withIntro, spectator, { now: intro }).actions),
    ).toEqual(['Watch intro'])
  })
})

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

  it('keeps participant tools visible but muted before coding', () => {
    const tabs = eventTabs({ ...base, now: start - 1 })
    expect(names(tabs)).toEqual([
      'Info',
      'Teams',
      'My Team',
      'Match Making',
      'Gambling',
    ])
    expect(tabs.find((t) => t.name === 'Match Making')?.hint).toBe(
      'Opens 09:00',
    )
  })

  it('unmutes during coding and marks tools closed afterwards', () => {
    expect(
      eventTabs({ ...base, now: start + 1 }).find(
        (t) => t.name === 'Match Making',
      )?.hint,
    ).toBeUndefined()
    expect(
      eventTabs({ ...base, now: deadline }).find((t) => t.name === 'Gambling')
        ?.hint,
    ).toBe('Closed')
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

describe('formatCountdown', () => {
  it('shows the two most significant units', () => {
    expect(formatCountdown(12 * 60_000)).toBe('12m 00s')
    expect(formatCountdown(3 * 3_600_000 + 12 * 60_000)).toBe('3h 12m')
    expect(formatCountdown(2 * 86_400_000 + 4 * 3_600_000)).toBe('2d 04h')
    expect(formatCountdown(-5)).toBe('0m 00s')
  })
})
