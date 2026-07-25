import { describe, expect, it } from 'vitest'
import { MatchPhase } from '@/app/actions/tournament-model'
import {getVisibleMatchResultScores} from "#/components/MatchesList.tsx";

describe('getVisibleMatchResultScores', () => {
  const results = [
    { team: { id: 'alpha', name: 'Alpha' }, score: 1216 },
    { team: { id: 'beta', name: 'Beta' }, score: 1184 },
  ]

  it('hides ELO results for match-making matches', () => {
    expect(
      getVisibleMatchResultScores({ phase: MatchPhase.QUEUE, results }).size,
    ).toBe(0)
  })

  it('keeps competition scores visible', () => {
    const scores = getVisibleMatchResultScores({
      phase: MatchPhase.SWISS,
      results,
    })

    expect(scores.get('alpha')).toBe(1216)
    expect(scores.get('beta')).toBe(1184)
  })
})
