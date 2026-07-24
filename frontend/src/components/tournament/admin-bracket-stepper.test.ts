import { describe, expect, it } from 'vitest'
import type { Match } from '@/app/actions/tournament-model'
import {
  getInitialRevealIndex,
  getStreamVisibleMatches,
  orderMatchesForReveal,
} from '@/components/tournament/admin-bracket-stepper'
import { MatchPhase, MatchState } from '@/app/actions/tournament-model'

function createMatch(
  overrides: Partial<Match> & Pick<Match, 'id' | 'round'>,
): Match {
  const { id, round, ...optionalOverrides } = overrides

  return {
    id,
    round,
    state: MatchState.FINISHED,
    phase: MatchPhase.ELIMINATION,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isRevealed: false,
    teams: [],
    results: [],
    ...optionalOverrides,
  }
}

describe('admin bracket reveal order', () => {
  it('orders matches round by round and places the third-place match last', () => {
    const matches = [
      createMatch({ id: 'final', round: 2 }),
      createMatch({
        id: 'semi-2',
        round: 1,
        createdAt: '2026-01-02T00:00:00.000Z',
      }),
      createMatch({ id: 'third', round: 2, isPlacementMatch: true }),
      createMatch({ id: 'semi-1', round: 1 }),
    ]

    expect(orderMatchesForReveal(matches).map((match) => match.id)).toEqual([
      'semi-1',
      'semi-2',
      'final',
      'third',
    ])
  })

  it('starts on the first finished match that has not been revealed', () => {
    const matches = [
      createMatch({ id: 'revealed', round: 0, isRevealed: true }),
      createMatch({ id: 'planned', round: 0, state: MatchState.PLANNED }),
      createMatch({ id: 'ready', round: 0 }),
    ]

    expect(getInitialRevealIndex(matches)).toBe(2)
  })

  it('never exposes an unrevealed result in the streamed bracket', () => {
    const hiddenMatch = createMatch({
      id: 'hidden',
      round: 0,
      winner: { id: 'winner', name: 'Winner', score: 3 },
      results: [
        { team: { id: 'winner', name: 'Winner' }, score: 3 },
        { team: { id: 'loser', name: 'Loser' }, score: 1 },
      ],
    })
    const revealedMatch = createMatch({
      id: 'revealed',
      round: 0,
      isRevealed: true,
      winner: { id: 'winner', name: 'Winner', score: 3 },
    })

    const [streamedHiddenMatch, streamedRevealedMatch] =
      getStreamVisibleMatches([hiddenMatch, revealedMatch])

    expect(streamedHiddenMatch).toMatchObject({
      state: MatchState.PLANNED,
      winner: undefined,
      results: [],
    })
    expect(streamedRevealedMatch).toBe(revealedMatch)
  })
})
