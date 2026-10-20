import { describe, expect, it } from 'vitest'
import { eventMoment, formatCountdown } from './event-moment'
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
  showtimeStreamUrl: null,
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

  it('tells registered viewers without a team to form one', () => {
    const moment = eventMoment(event, noTeam, { now: start + 1 })
    expect(moment.description).toMatch(/create a team or join one/)
    expect(moment.actions).toEqual([])
  })

  it('counts down coding without in-app links, which the tabs cover', () => {
    const moment = eventMoment(event, member('READY'), { now: start + 1 })
    expect(moment).toMatchObject({
      headline: 'Coding ends in',
      tone: 'active',
      actions: [],
    })
  })

  it('warns in the final three hours of coding', () => {
    const moment = eventMoment(event, member('READY'), {
      now: deadline - 60 * 60 * 1000,
    })
    expect(moment).toMatchObject({ tone: 'warning', kicker: 'Final hours' })
  })

  it('lets a failed repository override the headline but keeps the deadline countdown', () => {
    const moment = eventMoment(event, member('FAILED'), { now: start + 1 })
    expect(moment).toMatchObject({
      tone: 'danger',
      headline: 'Repository setup failed',
      countdownLabel: 'Coding ends in',
    })
  })

  it('closes coding at the deadline even before the server transition', () => {
    const moment = eventMoment(event, member('LOCKING'), { now: deadline })
    expect(moment).toMatchObject({
      phase: 'SUBMISSIONS_CLOSED',
      countdownTo: null,
    })
  })

  it('offers the stream during Showtime', () => {
    const live = {
      ...event,
      state: 'SHOWCASE' as const,
      streamUrl: 'https://s',
    }
    expect(labels(eventMoment(live, spectator).actions)).toEqual([
      'Watch stream',
    ])
    expect(
      eventMoment({ ...live, streamUrl: null }, spectator).actions,
    ).toEqual([])
  })

  it('prefers the separate Showtime stream during Showtime', () => {
    const live = {
      ...event,
      state: 'SHOWCASE' as const,
      streamUrl: 'https://s',
      showtimeStreamUrl: 'https://showtime',
    }
    expect(eventMoment(live, spectator).actions).toEqual([
      { kind: 'link', label: 'Watch stream', href: 'https://showtime' },
    ])
  })

  it('has no call to action once completed', () => {
    const moment = eventMoment(
      { ...event, state: 'COMPLETED' },
      member('LOCKED'),
    )
    expect(moment).toMatchObject({ actions: [] })
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
    // The intro keeps the main stream even when a Showtime stream is set.
    expect(
      eventMoment(
        { ...withIntro, showtimeStreamUrl: 'https://showtime' },
        spectator,
        { now: intro },
      ).actions,
    ).toEqual([{ kind: 'link', label: 'Watch intro', href: 'https://s' }])
  })
})

describe('loading viewer', () => {
  it('shows no call to action until the viewer is known', () => {
    const priv = { ...event, isPrivate: true }
    expect(eventMoment(priv, null, { now: start - 1 })).toMatchObject({
      headline: 'Coding starts in',
      actions: [],
    })
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
