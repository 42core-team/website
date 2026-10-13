// @vitest-environment jsdom

import type { Team } from '@/app/actions/team'
import type { Match } from '@/app/actions/tournament-model'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { MatchPhase, MatchState } from '@/app/actions/tournament-model'
import { BracketRankingTable } from '@/components/tournament/bracket-ranking-table'
import { GroupPhaseRankingTable } from '@/components/tournament/group-phase-ranking-table'
import {
  getRankingTags,
  RankingTagFilter,
} from '@/components/tournament/ranking-tag-filter'

vi.mock('@/lib/router-hooks', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const teams: Team[] = [
  {
    id: 'alpha',
    name: 'Alpha',
    repo: '',
    inQueue: false,
    credits: 0,
    score: 10,
    buchholzPoints: 5,
    hadBye: false,
    tags: ['42-berlin', 'international'],
  },
  {
    id: 'beta',
    name: 'Beta',
    repo: '',
    inQueue: false,
    credits: 0,
    score: 8,
    buchholzPoints: 4,
    hadBye: false,
    tags: ['42-paris', 'international'],
  },
]

const finishedMatch: Match = {
  id: 'final',
  round: 1,
  state: MatchState.FINISHED,
  phase: MatchPhase.ELIMINATION,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  isRevealed: true,
  teams: [
    { id: 'alpha', name: 'Alpha', score: 3 },
    { id: 'beta', name: 'Beta', score: 1 },
  ],
  winner: { id: 'alpha', name: 'Alpha', score: 3 },
  results: [],
}

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = vi.fn()
  HTMLElement.prototype.setPointerCapture = vi.fn()
  HTMLElement.prototype.releasePointerCapture = vi.fn()
  HTMLElement.prototype.scrollIntoView = vi.fn()
})

afterEach(cleanup)

function selectTag(tag: string) {
  fireEvent.pointerDown(screen.getByRole('combobox'), {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse',
  })
  fireEvent.click(screen.getByRole('option', { name: tag }))
}

describe('ranking tag filters', () => {
  it('builds a sorted list without duplicate tags', () => {
    expect(getRankingTags(teams)).toEqual([
      '42-berlin',
      '42-paris',
      'international',
    ])
  })

  it('allows selecting and clearing a tag', () => {
    const onSelectedTagChange = vi.fn()
    const { rerender } = render(
      <RankingTagFilter
        tags={getRankingTags(teams)}
        selectedTag={null}
        onSelectedTagChange={onSelectedTagChange}
      />,
    )

    selectTag('42-paris')
    expect(onSelectedTagChange).toHaveBeenCalledWith('42-paris')

    rerender(
      <RankingTagFilter
        tags={getRankingTags(teams)}
        selectedTag="42-paris"
        onSelectedTagChange={onSelectedTagChange}
      />,
    )
    selectTag('All tags')
    expect(onSelectedTagChange).toHaveBeenCalledWith(null)
  })

  it('filters the group ranking and preserves the overall rank', () => {
    render(
      <GroupPhaseRankingTable
        teams={teams}
        matches={[]}
        eventId="event-1"
        advancementCount={1}
        selectedTag="42-paris"
      />,
    )

    expect(screen.queryByText('Alpha')).toBeNull()
    const betaRow = screen.getByText('Beta').closest('tr')
    expect(betaRow).not.toBeNull()
    expect(within(betaRow!).getByText('2')).toBeTruthy()
  })

  it('filters the tournament ranking without changing standings', () => {
    render(
      <BracketRankingTable
        teams={teams}
        matches={[finishedMatch]}
        eventId="event-1"
        selectedTag="42-paris"
      />,
    )

    expect(screen.queryByText('Alpha')).toBeNull()
    const betaRow = screen.getByText('Beta').closest('tr')
    expect(betaRow).not.toBeNull()
    expect(within(betaRow!).getByText('2')).toBeTruthy()
    expect(betaRow!.querySelector('.text-slate-400')).not.toBeNull()
  })
})
