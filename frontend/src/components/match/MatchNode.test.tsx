// @vitest-environment jsdom

import type { Match } from '@/app/actions/tournament-model'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MatchPhase, MatchState } from '@/app/actions/tournament-model'
import MatchNode from '@/components/match/MatchNode'

vi.mock('@/lib/router-hooks', () => ({
  useParams: () => ({ id: 'event-1' }),
  useRouter: () => ({ push: vi.fn() }),
}))

afterEach(cleanup)

const finished: Match = {
  id: 'match-1',
  round: 0,
  state: MatchState.FINISHED,
  phase: MatchPhase.SWISS,
  isRevealed: true,
  createdAt: '2026-01-01T00:00:00Z',
  teams: [
    { id: 'alpha', name: 'Alpha' },
    { id: 'beta', name: 'Beta' },
  ],
  winner: { id: 'alpha', name: 'Alpha' },
}

describe('match node scores', () => {
  it('shows result scores', () => {
    render(
      <MatchNode
        data={{
          match: {
            ...finished,
            results: [
              { team: { id: 'alpha', name: 'Alpha' }, score: 3 },
              { team: { id: 'beta', name: 'Beta' }, score: 1 },
            ],
          },
        }}
      />,
    )
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
  })

  it('shows no score without a result', () => {
    const { container } = render(<MatchNode data={{ match: finished }} />)
    expect(screen.getByText('Alpha')).toBeTruthy()
    expect(container.querySelectorAll('span.ml-2')).toHaveLength(0)
  })

  it('renders an unrevealed match without an id', () => {
    render(
      <MatchNode
        data={{
          match: {
            round: 0,
            state: MatchState.PLANNED,
            phase: MatchPhase.ELIMINATION,
            isRevealed: false,
            createdAt: '2026-01-01T00:00:00Z',
            teams: [{ id: 'alpha', name: 'Alpha' }],
          },
        }}
      />,
    )
    expect(screen.getByText('Match TBD')).toBeTruthy()
    expect(screen.getByText('TBD')).toBeTruthy()
  })
})
