// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Match } from '@/app/actions/tournament-model'
import { MatchPhase, MatchState } from '@/app/actions/tournament-model'
import { MatchTeamHeader } from './MatchTeamHeader'
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
afterEach(cleanup)
const match: Match = {
  round: 1,
  state: MatchState.FINISHED,
  phase: MatchPhase.SWISS,
  createdAt: '',
  updatedAt: '',
  isRevealed: false,
  teams: [
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Beta' },
  ],
  winner: { id: 'a', name: 'Alpha' },
  results: [],
}
describe('match team header', () => {
  it.each([MatchPhase.SWISS, MatchPhase.ELIMINATION, MatchPhase.GAMBLING])(
    'displays revealed %s scores',
    (phase) => {
      render(
        <MatchTeamHeader
          match={{
            ...match,
            phase,
            isRevealed: true,
            results: [{ team: match.teams[0], score: 1234 }],
          }}
          eventId="event"
        />,
      )
      expect(screen.getByText('1234')).toBeTruthy()
    },
  )

  it('never displays QUEUE ratings even if results are present', () => {
    render(
      <MatchTeamHeader
        match={{
          ...match,
          phase: MatchPhase.QUEUE,
          isRevealed: true,
          results: [{ team: match.teams[0], score: 1234 }],
        }}
        eventId="event"
      />,
    )
    expect(screen.queryByText('1234')).toBeNull()
  })

  it('shows team pictures and background covers', () => {
    const { container } = render(
      <MatchTeamHeader
        match={{
          ...match,
          teams: [
            {
              id: 'a',
              name: 'Alpha',
              picture: { small: 'alpha-small.webp', large: 'alpha-large.webp' },
              background: { small: 'bg-small.webp', large: 'bg-large.webp' },
            },
            match.teams[1],
          ],
        }}
        eventId="event"
      />,
    )
    expect(container.querySelector('img[src$="/bg-large.webp"]')).toBeTruthy()
    // The team without artwork falls back to its initials.
    expect(screen.getByText('BE')).toBeTruthy()
  })

  it.each([MatchPhase.SWISS, MatchPhase.QUEUE])(
    'never marks the winner of a revealed %s match',
    (phase) => {
      render(
        <MatchTeamHeader
          match={{ ...match, phase, isRevealed: true }}
          eventId="event"
        />,
      )
      expect(screen.queryByText('Winner')).toBeNull()
      expect(screen.getByText('Alpha')).toBeTruthy()
    },
  )
})
