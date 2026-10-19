import { describe, expect, it } from 'vitest'
import type { Event } from '@/app/actions/event'
import {
  bettingOpen,
  eventState,
  matchmakingOpen,
  registrationOpen,
  teamEditsOpen,
} from './event-lifecycle'

const start = Date.parse('2026-10-19T10:00:00Z')
const deadline = Date.parse('2026-10-19T12:00:00Z')
const event = {
  state: 'REGISTRATION' as const,
  startDate: new Date(start).toISOString(),
  submissionDeadline: new Date(deadline).toISOString(),
  gamblingEnabled: true,
}

describe('lifecycle participation boundaries', () => {
  it('allows roster edits before the deadline but waits for in-flight repository access changes', () => {
    expect(
      teamEditsOpen(event, { repositoryStatus: 'PENDING' }, start - 1),
    ).toBe(true)
    expect(
      teamEditsOpen(event, { repositoryStatus: 'READY' }, deadline - 1),
    ).toBe(true)
    expect(
      teamEditsOpen(
        event,
        { repositoryStatus: 'UNLOCKING', locked: true },
        start,
      ),
    ).toBe(false)
    expect(
      teamEditsOpen(event, { repositoryStatus: 'PROVISIONING' }, start),
    ).toBe(false)
    expect(
      teamEditsOpen(event, { repositoryStatus: 'FAILED', locked: true }, start),
    ).toBe(false)
    expect(teamEditsOpen(event, { repositoryStatus: 'READY' }, deadline)).toBe(
      false,
    )
  })
  it('allows registration through play, but closes all writes exactly at the deadline', () => {
    expect(eventState(event, start - 1)).toBe('REGISTRATION')
    expect(eventState(event, start)).toBe('PLAYING')
    expect(registrationOpen(event, deadline - 1)).toBe(true)
    expect(
      matchmakingOpen(event, { repositoryStatus: 'READY' }, deadline - 1),
    ).toBe(true)
    expect(bettingOpen(event, deadline - 1)).toBe(true)
    expect(eventState(event, deadline)).toBe('SUBMISSIONS_CLOSED')
    expect(registrationOpen(event, deadline)).toBe(false)
    expect(
      matchmakingOpen(event, { repositoryStatus: 'READY' }, deadline),
    ).toBe(false)
    expect(bettingOpen(event, deadline)).toBe(false)
  })

  it.each<Event['state']>(['SUBMISSIONS_CLOSED', 'SHOWCASE', 'COMPLETED'])(
    'does not reopen %s just because its deadline is changed',
    (state) => {
      const closed = { ...event, state }
      expect(eventState(closed, start)).toBe(state)
      expect(registrationOpen(closed, start)).toBe(false)
      expect(bettingOpen(closed, start)).toBe(false)
    },
  )

  it('reopens with a future deadline beyond the past scheduled end, waiting for repository writes', () => {
    const reopened = {
      ...event,
      state: 'PLAYING' as const,
      scheduledEndDate: new Date(deadline).toISOString(),
      submissionDeadline: new Date(deadline + 7200000).toISOString(),
    }
    const now = deadline + 3600000
    expect(registrationOpen(reopened, now)).toBe(true)
    expect(
      matchmakingOpen(reopened, { repositoryStatus: 'UNLOCKING' }, now),
    ).toBe(false)
    expect(matchmakingOpen(reopened, { repositoryStatus: 'FAILED' }, now)).toBe(
      false,
    )
    expect(matchmakingOpen(reopened, { repositoryStatus: 'READY' }, now)).toBe(
      true,
    )
    expect(
      matchmakingOpen(
        reopened,
        { repositoryStatus: 'READY', tournamentExcluded: true },
        now,
      ),
    ).toBe(true)
    expect(bettingOpen(reopened, now)).toBe(true)
  })
})
