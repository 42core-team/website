import { describe, expect, it } from 'vitest'
import type { Event } from '@/app/actions/event'
import {
  buildEventsViewModel,
  buildPublicEventsViewModel,
  getEventStatus,
} from '@/app/events/events-view'

const NOW = new Date('2026-08-06T12:00:00.000Z').getTime()

function event(id: string, startDate: string, endDate: string): Event {
  return {
    id,
    name: `Event ${id}`,
    startDate,
    endDate,
    minTeamSize: 1,
    maxTeamSize: 4,
    currentRound: 0,
    githubOrg: 'core-game',
    canCreateTeam: true,
    lockedAt: null,
    processQueue: true,
    maxQueueCredits: 5,
    queueCreditIntervalMinutes: 15,
    isPrivate: false,
  }
}

describe('events view model', () => {
  it('features an active joined event above a newer upcoming event', () => {
    const active = event(
      'active',
      '2026-08-05T12:00:00.000Z',
      '2026-08-07T12:00:00.000Z',
    )
    const upcoming = event(
      'upcoming',
      '2026-09-01T12:00:00.000Z',
      '2026-09-02T12:00:00.000Z',
    )

    const result = buildEventsViewModel([active, upcoming], [active], NOW)

    expect(result.featuredEvent?.id).toBe('active')
    expect(result.events.map(({ id }) => id)).toEqual(['upcoming'])
  })

  it('features the latest-starting event when multiple joined events are active', () => {
    const earlier = event(
      'earlier',
      '2026-08-01T12:00:00.000Z',
      '2026-08-08T12:00:00.000Z',
    )
    const later = event(
      'later',
      '2026-08-06T10:00:00.000Z',
      '2026-08-07T12:00:00.000Z',
    )

    const result = buildEventsViewModel([], [earlier, later], NOW)

    expect(result.featuredEvent?.id).toBe('later')
  })

  it('features the most recently ended event within seven days', () => {
    const recent = event(
      'recent',
      '2026-08-03T12:00:00.000Z',
      '2026-08-05T12:00:00.000Z',
    )
    const older = event(
      'older',
      '2026-08-01T12:00:00.000Z',
      '2026-08-04T12:00:00.000Z',
    )

    const result = buildEventsViewModel([], [older, recent], NOW)

    expect(result.featuredEvent?.id).toBe('recent')
  })

  it('features an upcoming joined event before a recently completed event', () => {
    const upcoming = event(
      'upcoming',
      '2026-08-10T12:00:00.000Z',
      '2026-08-11T12:00:00.000Z',
    )
    const recent = event(
      'recent',
      '2026-08-03T12:00:00.000Z',
      '2026-08-05T12:00:00.000Z',
    )

    const result = buildEventsViewModel([], [recent, upcoming], NOW)

    expect(result.featuredEvent?.id).toBe('upcoming')
  })

  it('features the next upcoming joined event', () => {
    const next = event(
      'next',
      '2026-08-10T12:00:00.000Z',
      '2026-08-11T12:00:00.000Z',
    )
    const later = event(
      'later',
      '2026-09-01T12:00:00.000Z',
      '2026-09-02T12:00:00.000Z',
    )

    const result = buildEventsViewModel([], [later, next], NOW)

    expect(result.featuredEvent?.id).toBe('next')
  })

  it('does not feature an event that ended more than seven days ago', () => {
    const old = event(
      'old',
      '2026-07-20T12:00:00.000Z',
      '2026-07-29T11:59:59.000Z',
    )

    const result = buildEventsViewModel([], [old], NOW)

    expect(result.featuredEvent).toBeUndefined()
  })

  it('falls back to a public featured event when the user joined no events', () => {
    const upcoming = event(
      'upcoming',
      '2026-08-10T12:00:00.000Z',
      '2026-08-11T12:00:00.000Z',
    )

    const result = buildEventsViewModel([upcoming], [], NOW)

    expect(result.featuredEvent?.id).toBe('upcoming')
    expect(result.joinedEventIds.has('upcoming')).toBe(false)
    expect(result.events).toEqual([])
  })

  it('merges, deduplicates, removes the featured event, and sorts the rest newest first', () => {
    const newest = event(
      'newest',
      '2026-10-01T12:00:00.000Z',
      '2026-10-02T12:00:00.000Z',
    )
    const middle = event(
      'middle',
      '2026-09-01T12:00:00.000Z',
      '2026-09-02T12:00:00.000Z',
    )
    const oldest = event(
      'oldest',
      '2026-08-15T12:00:00.000Z',
      '2026-08-16T12:00:00.000Z',
    )

    const result = buildEventsViewModel([oldest, newest, middle], [middle], NOW)

    expect(result.featuredEvent?.id).toBe('middle')
    expect(result.events.map(({ id }) => id)).toEqual(['newest', 'oldest'])
    expect(result.joinedEventIds.has('middle')).toBe(true)
  })
})

describe('event status', () => {
  it('uses event dates rather than tournament rounds', () => {
    expect(
      getEventStatus(
        event(
          'upcoming',
          '2026-08-07T12:00:00.000Z',
          '2026-08-08T12:00:00.000Z',
        ),
        NOW,
      ),
    ).toBe('upcoming')
    expect(
      getEventStatus(
        event('live', '2026-08-05T12:00:00.000Z', '2026-08-07T12:00:00.000Z'),
        NOW,
      ),
    ).toBe('live')
    expect(
      getEventStatus(
        event(
          'completed',
          '2026-08-01T12:00:00.000Z',
          '2026-08-05T12:00:00.000Z',
        ),
        NOW,
      ),
    ).toBe('completed')
  })
})

describe('public events view model', () => {
  it('features a public active event for logged-out visitors', () => {
    const active = event(
      'active',
      '2026-08-05T12:00:00.000Z',
      '2026-08-07T12:00:00.000Z',
    )
    const upcoming = event(
      'upcoming',
      '2026-09-01T12:00:00.000Z',
      '2026-09-02T12:00:00.000Z',
    )

    const result = buildPublicEventsViewModel([upcoming, active], NOW)

    expect(result.featuredEvent?.id).toBe('active')
  })

  it('sorts the remaining public events with the oldest at the bottom', () => {
    const featured = event(
      'featured',
      '2026-08-10T12:00:00.000Z',
      '2026-08-11T12:00:00.000Z',
    )
    const newest = event(
      'newest',
      '2026-10-01T12:00:00.000Z',
      '2026-10-02T12:00:00.000Z',
    )
    const oldest = event(
      'oldest',
      '2026-07-01T12:00:00.000Z',
      '2026-07-02T12:00:00.000Z',
    )

    const result = buildPublicEventsViewModel([oldest, newest, featured], NOW)

    expect(result.featuredEvent?.id).toBe('featured')
    expect(result.events.map(({ id }) => id)).toEqual(['newest', 'oldest'])
  })
})
