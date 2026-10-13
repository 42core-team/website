// @vitest-environment jsdom

import type { Team } from '@/app/actions/team'
import type { Match } from '@/app/actions/tournament-model'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MatchPhase, MatchState } from '@/app/actions/tournament-model'
import { BracketRankingTable } from '@/components/tournament/bracket-ranking-table'

vi.mock('@/lib/router-hooks', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

afterEach(cleanup)

const team: Team = {
  id: 'winner',
  name: 'Unrevealed winner',
  repo: '',
  inQueue: false,
  credits: 0,
  score: 0,
  buchholzPoints: 0,
  hadBye: false,
  tags: [],
}
const match: Match = {
  id: 'final',
  round: 1,
  state: MatchState.FINISHED,
  phase: MatchPhase.ELIMINATION,
  isRevealed: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  teams: [team],
  results: [],
  winner: team,
}

describe('bracket ranking visibility', () => {
  it('includes unrevealed finished matches only in admin view', () => {
    const { rerender } = render(
      <BracketRankingTable
        eventId="event-1"
        teams={[team]}
        matches={[match]}
      />,
    )
    expect(screen.queryByText(team.name)).toBeNull()

    rerender(
      <BracketRankingTable
        eventId="event-1"
        teams={[team]}
        matches={[match]}
        isAdminView
      />,
    )
    expect(screen.getByText(team.name)).toBeTruthy()
    expect(screen.getByText('W')).toBeTruthy()
  })

  it('does not rank unfinished matches in admin view', () => {
    render(
      <BracketRankingTable
        eventId="event-1"
        teams={[team]}
        matches={[{ ...match, state: MatchState.PLANNED, winner: undefined }]}
        isAdminView
      />,
    )
    expect(screen.queryByText(team.name)).toBeNull()
  })
})
