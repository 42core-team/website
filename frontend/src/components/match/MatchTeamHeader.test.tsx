// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Match } from '@/app/actions/tournament-model'
import { MatchPhase, MatchState } from '@/app/actions/tournament-model'
import { MatchTeamHeader } from './MatchTeamHeader'
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
const match: Match = {
  round: 1,
  state: MatchState.FINISHED,
  phase: MatchPhase.SWISS,
  createdAt: '',
  updatedAt: '',
  isRevealed: false,
  teams: [
    { id: 'a', name: 'Alpha', score: 1 },
    { id: 'b', name: 'Beta', score: 0 },
  ],
  winner: { id: 'a', name: 'Alpha', score: 1 },
  results: [],
}
describe('match team header', () => {
  it('does not reveal the winner of an unrevealed match', () => {
    const view = render(<MatchTeamHeader match={match} eventId="event" />)
    expect(screen.queryByText('Winner')).toBeNull()
    expect(screen.getByText('Alpha')).toBeTruthy()
    view.rerender(
      <MatchTeamHeader
        match={{ ...match, isRevealed: true }}
        eventId="event"
      />,
    )
    expect(screen.getByText('Winner')).toBeTruthy()
  })
})
