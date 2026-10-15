// @vitest-environment jsdom

import type { Match } from '@/app/actions/tournament-model'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MatchPhase, MatchState } from '@/app/actions/tournament-model'
import { BracketTabs } from '@/components/tournament/tournament-tabs'

vi.mock('@/hooks/useTabParam', () => ({
  useTabParam: () => ({ currentTab: 'graph', onTabChange: vi.fn() }),
}))

vi.mock('@/components/tournament/bracket-graph-view', () => ({
  BracketGraphView: ({ matches }: { matches: Match[] }) => (
    <div data-testid="bracket-results">
      {matches.map((match) => match.winner?.name).join(', ')}
    </div>
  ),
}))

vi.mock(
  '@/components/tournament/admin-bracket-stepper',
  async (importOriginal) => {
    const original = await importOriginal<Record<string, unknown>>()
    return {
      ...original,
      AdminBracketStepper: () => <div>Reveal controls</div>,
    }
  },
)

afterEach(cleanup)

const matches: Match[] = [
  {
    id: 'final',
    round: 1,
    state: MatchState.FINISHED,
    phase: MatchPhase.ELIMINATION,
    isRevealed: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    teams: [],
    results: [],
    winner: { id: 'winner', name: 'Unrevealed winner', score: 1 },
  },
]

function bracket(isAdminReveal: boolean, isEventAdmin = true) {
  return (
    <BracketTabs
      eventId="event-1"
      matches={matches}
      teams={[]}
      teamCount={4}
      isEventAdmin={isEventAdmin}
      isAdminReveal={isAdminReveal}
    />
  )
}

describe('bracket admin view and reveal panel', () => {
  it('shows admin results on toggle and only opens the panel on button click', () => {
    const { rerender } = render(bracket(false))
    expect(screen.getByTestId('bracket-results').textContent).toBe('')

    rerender(bracket(true))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('bracket-results').textContent).toBe(
      'Unrevealed winner',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open reveal mode' }))
    const panel = screen.getByRole('dialog')
    expect(within(panel).getByText('Reveal controls')).toBeTruthy()
    expect(within(panel).getByTestId('bracket-results').textContent).toBe('')

    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('bracket-results').textContent).toBe(
      'Unrevealed winner',
    )
  })

  it('keeps the panel closed when loading directly into admin view', () => {
    render(bracket(true))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens reveal mode with admin view off and stays open across toggles', () => {
    const { rerender } = render(bracket(false))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open reveal mode' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    rerender(bracket(true))
    expect(screen.getByRole('dialog')).toBeTruthy()
    rerender(bracket(false))
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('closes the panel when admin access is removed', () => {
    const { rerender } = render(bracket(false))
    fireEvent.click(screen.getByRole('button', { name: 'Open reveal mode' }))
    rerender(bracket(false, false))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps unrevealed results hidden for visitors with the admin URL flag', () => {
    render(bracket(true, false))
    expect(screen.getByTestId('bracket-results').textContent).toBe('')
    expect(
      screen.queryByRole('button', { name: 'Open reveal mode' }),
    ).toBeNull()
  })
})
