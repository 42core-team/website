// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Event } from '@/app/actions/event'
import EventsTable from '@/app/events/EventTable'

const push = vi.fn()

vi.mock('@/lib/router-hooks', () => ({
  useRouter: () => ({ push }),
}))

afterEach(() => {
  cleanup()
  push.mockReset()
})

function event(index: number): Event {
  return {
    id: `event-${index}`,
    name: `Event ${index}`,
    startDate: `2026-09-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
    endDate: `2026-09-${String(index + 2).padStart(2, '0')}T12:00:00.000Z`,
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

describe('EventsTable', () => {
  it('renders responsive empty states', () => {
    render(<EventsTable events={[]} now={Date.now()} />)

    expect(screen.getAllByText('No events found')).toHaveLength(2)
  })

  it('marks joined events and opens event details', () => {
    render(
      <EventsTable
        events={[event(0)]}
        joinedEventIds={new Set(['event-0'])}
        now={new Date('2026-08-01T12:00:00.000Z').getTime()}
      />,
    )

    expect(screen.getAllByText('Joined')).toHaveLength(2)
    fireEvent.click(screen.getAllByLabelText('Open Event 0')[0])
    expect(push).toHaveBeenCalledWith('/events/event-0')
  })

  it('paginates after fifteen events', () => {
    render(
      <EventsTable
        events={Array.from({ length: 16 }, (_, index) => event(index))}
        now={new Date('2026-08-01T12:00:00.000Z').getTime()}
      />,
    )

    expect(screen.queryByText('Event 15')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getAllByText('Event 15')).toHaveLength(2)
    expect(screen.getByText('Page 2 of 2')).toBeTruthy()
  })
})
