// @vitest-environment jsdom

import type { Match } from '@/app/actions/tournament-model'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MatchPhase, MatchState } from '@/app/actions/tournament-model'
import {
  getMyRoundResult,
  getTeamScore,
  groupMatchesByRound,
  GroupPhaseGraphView,
  hasVisibleCompetitors,
} from '@/components/tournament/group-phase-graph-view'

const push = vi.fn()

vi.mock('@/lib/router-hooks', () => ({
  useParams: () => ({ id: 'event-1' }),
  useRouter: () => ({ push }),
}))

function createMatch(
  id: string | undefined,
  round: number,
  state: MatchState,
  overrides: Partial<Match> = {},
): Match {
  return {
    id,
    round,
    state,
    phase: MatchPhase.SWISS,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    isRevealed: state === MatchState.FINISHED,
    teams: [
      { id: 'alpha', name: 'Alpha', score: 1 },
      { id: 'beta', name: 'Beta', score: 0 },
    ],
    winner:
      state === MatchState.FINISHED
        ? { id: 'alpha', name: 'Alpha', score: 1 }
        : undefined,
    results:
      state === MatchState.FINISHED
        ? [
            { team: { id: 'alpha', name: 'Alpha' }, score: 3 },
            { team: { id: 'beta', name: 'Beta' }, score: 2 },
          ]
        : [],
    ...overrides,
  }
}

beforeEach(() => {
  push.mockReset()
  window.sessionStorage.clear()
  window.scrollTo = vi.fn()
  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    value: 0,
    writable: true,
  })
})
afterEach(cleanup)

describe('round presentation model', () => {
  it('sorts rounds and preserves match order within each round', () => {
    const roundTwoFirst = createMatch('two-first', 2, MatchState.PLANNED)
    const roundOne = createMatch('one', 1, MatchState.FINISHED)
    const roundTwoSecond = createMatch('two-second', 2, MatchState.IN_PROGRESS)

    const rounds = groupMatchesByRound([
      roundTwoFirst,
      roundOne,
      roundTwoSecond,
    ])

    expect(rounds.map((round) => round.round)).toEqual([1, 2])
    expect(rounds[1].matches).toEqual([roundTwoFirst, roundTwoSecond])
    expect(rounds[1].counts).toEqual({
      [MatchState.PLANNED]: 1,
      [MatchState.IN_PROGRESS]: 1,
      [MatchState.FINISHED]: 0,
    })
  })

  it('uses result scores first and keeps unfinished competitors hidden', () => {
    const finished = createMatch('finished', 0, MatchState.FINISHED)
    const planned = createMatch('planned', 1, MatchState.PLANNED)

    expect(getTeamScore(finished, 'alpha', 1)).toBe(3)
    expect(getTeamScore(finished, 'missing', 4)).toBe(4)
    expect(hasVisibleCompetitors(finished)).toBe(true)
    expect(hasVisibleCompetitors(planned)).toBe(false)
  })

  it('summarizes only disclosed current-team results', () => {
    const finished = createMatch('finished', 0, MatchState.FINISHED)
    const planned = createMatch('planned', 1, MatchState.PLANNED)

    expect(
      getMyRoundResult(groupMatchesByRound([finished])[0], 'beta'),
    ).toEqual({ outcome: 'Lost', opponentName: 'Alpha' })
    expect(
      getMyRoundResult(groupMatchesByRound([planned])[0], 'beta'),
    ).toBeNull()
  })
})

describe('compact round view', () => {
  it('renders the compact columns, user-facing round numbers, and no controls', () => {
    render(
      <GroupPhaseGraphView
        matches={[
          createMatch('round-2', 1, MatchState.PLANNED),
          createMatch('round-1', 0, MatchState.FINISHED),
        ]}
        isEventAdmin={false}
      />,
    )

    const firstRound = screen.getByRole('button', { name: /Round 1/ })
    const secondRound = screen.getByRole('button', { name: /Round 2/ })
    expect(firstRound.getAttribute('aria-expanded')).toBe('true')
    expect(secondRound.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByText('Team 1')).toBeTruthy()
    expect(screen.getByText('Team 2')).toBeTruthy()
    expect(screen.getByText('Score')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Expand all' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Collapse all' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Jump to my match' }),
    ).toBeNull()

    fireEvent.click(secondRound)
    expect(secondRound.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Planned')).toBeTruthy()
  })

  it('renders the shared empty state', () => {
    render(<GroupPhaseGraphView matches={[]} isEventAdmin={false} />)
    expect(
      screen.getByText('Matches will appear here once the group phase starts.'),
    ).toBeTruthy()
  })

  it('opens finished matches for visitors but not unfinished matches', () => {
    render(
      <GroupPhaseGraphView
        matches={[
          createMatch('finished', 0, MatchState.FINISHED),
          createMatch('planned', 0, MatchState.PLANNED),
        ]}
        isEventAdmin={false}
      />,
    )

    fireEvent.click(screen.getByLabelText('Open match finished'))
    expect(push).toHaveBeenCalledWith('/events/event-1/match/finished')
    push.mockReset()
    fireEvent.click(screen.getByText('Planned'))
    expect(push).not.toHaveBeenCalled()
  })

  it('lets admins open unfinished matches', () => {
    render(
      <GroupPhaseGraphView
        matches={[createMatch('active', 0, MatchState.IN_PROGRESS)]}
        isEventAdmin
      />,
    )
    fireEvent.click(screen.getByLabelText('Open match active'))
    expect(push).toHaveBeenCalledWith('/events/event-1/match/active')
  })

  it('opens team details independently and emphasizes the winner', () => {
    render(
      <GroupPhaseGraphView
        matches={[createMatch('finished', 0, MatchState.FINISHED)]}
        isEventAdmin={false}
      />,
    )

    const matchLink = screen.getByLabelText('Open match finished')
    const alpha = within(matchLink).getByRole('button', { name: /Alpha/ })
    fireEvent.click(alpha)
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/events/event-1/teams/alpha')
    expect(within(alpha).getByLabelText('Winner')).toBeTruthy()
    expect(within(matchLink).getByLabelText('Score 3 to 2')).toBeTruthy()
    expect(alpha.closest('td')?.className).toContain('bg-amber-500/10')
  })

  it('highlights the entire disclosed current-team row and dims its summary', () => {
    const { rerender } = render(
      <GroupPhaseGraphView
        matches={[createMatch('mine', 0, MatchState.FINISHED)]}
        isEventAdmin={false}
        myTeamId="beta"
      />,
    )

    const ownRow = screen.getByLabelText('Open match mine')
    expect(ownRow.getAttribute('data-own-team')).toBe('true')
    expect(ownRow.className).toContain('bg-primary/10')
    const resultSummary = screen.getByText('You: Lost vs Alpha')
    expect(resultSummary.className).toContain('text-muted-foreground/80')

    rerender(
      <GroupPhaseGraphView
        matches={[createMatch('hidden', 0, MatchState.PLANNED)]}
        isEventAdmin
        myTeamId="beta"
      />,
    )
    expect(screen.queryByText('You')).toBeNull()
    expect(screen.queryByText(/You:/)).toBeNull()
  })

  it('renders ties and unavailable matchups consistently', () => {
    const { rerender } = render(
      <GroupPhaseGraphView
        matches={[
          createMatch('tie', 0, MatchState.FINISHED, {
            winner: undefined,
            results: [
              { team: { id: 'alpha', name: 'Alpha' }, score: 2 },
              { team: { id: 'beta', name: 'Beta' }, score: 2 },
            ],
          }),
        ]}
        isEventAdmin={false}
      />,
    )
    expect(screen.getByLabelText('Score 2 to 2')).toBeTruthy()
    expect(screen.queryByLabelText('Winner')).toBeNull()

    rerender(
      <GroupPhaseGraphView
        matches={[createMatch(undefined, 0, MatchState.PLANNED)]}
        isEventAdmin
      />,
    )
    expect(screen.getAllByText('TBD')).toHaveLength(2)
    expect(screen.queryByLabelText('Open match undefined')).toBeNull()
  })

  it('restores accordion and scroll state after navigating back', async () => {
    const matches = [
      createMatch('first', 0, MatchState.FINISHED),
      createMatch('second', 1, MatchState.FINISHED),
    ]
    const { unmount } = render(
      <GroupPhaseGraphView matches={matches} isEventAdmin={false} />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Round 1/ }))
    fireEvent.click(screen.getByRole('button', { name: /Round 2/ }))
    Object.defineProperty(window, 'scrollY', { value: 420, writable: true })
    fireEvent.scroll(window)
    unmount()

    render(<GroupPhaseGraphView matches={matches} isEventAdmin={false} />)

    expect(
      screen
        .getByRole('button', { name: /Round 1/ })
        .getAttribute('aria-expanded'),
    ).toBe('false')
    expect(
      screen
        .getByRole('button', { name: /Round 2/ })
        .getAttribute('aria-expanded'),
    ).toBe('true')
    await waitFor(() => {
      expect(window.scrollTo).toHaveBeenCalledWith({
        top: 420,
        behavior: 'instant',
      })
    })
  })
})
