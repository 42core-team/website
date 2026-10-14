// @vitest-environment jsdom

import type { AnchorHTMLAttributes } from 'react'
import type { QueueMatch } from '@/app/actions/tournament-model'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MatchPhase, MatchState } from '@/app/actions/tournament-model'
import MatchesList from '@/components/MatchesList'
import TeamMatchHistory from '@/components/team/TeamMatchHistory'

vi.mock('@/components/app-link', () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}))

afterEach(cleanup)

const alpha = { id: 'alpha', name: 'Alpha with a very long team name' }
const beta = { id: 'beta', name: 'Beta' }
const match: QueueMatch = {
  id: 'match-1',
  state: MatchState.FINISHED,
  phase: MatchPhase.SWISS,
  createdAt: '2026-10-01T12:00:00Z',
  teams: [alpha, beta],
  winner: beta,
  results: [
    { team: alpha, score: 2 },
    { team: beta, score: 5 },
  ],
}

function teamLinks() {
  return screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('href')?.includes('/teams/'))
}

function teamName(element: Element) {
  return element.querySelector('span.truncate')?.textContent
}

describe('match history team positioning', () => {
  it.each([alpha, beta])(
    'puts the viewed team $id first with its own score and winner',
    (team) => {
      render(<MatchesList eventId="event" matches={[match]} teamId={team.id} />)
      const links = teamLinks()
      expect(teamName(links[0])).toBe(team.name)
      const betaLink = links.find((link) => teamName(link) === beta.name)!
      expect(betaLink.querySelector('[aria-label="Winner"]')).toBeTruthy()
      expect(betaLink.nextElementSibling?.textContent).toBe('5')
      expect(match.teams).toEqual([alpha, beta])
    },
  )

  it.each([undefined, 'missing'])(
    'preserves the original order without a matching team (%s)',
    (teamId) => {
      render(<MatchesList eventId="event" matches={[match]} teamId={teamId} />)
      expect(teamLinks().map(teamName)).toEqual([alpha.name, beta.name])
    },
  )

  it('passes the team context through the history tabs', () => {
    render(
      <TeamMatchHistory
        eventId="event"
        teamId="beta"
        matches={[
          {
            ...match,
            round: 1,
            updatedAt: match.createdAt,
            isRevealed: true,
            teams: [
              { ...alpha, score: 2 },
              { ...beta, score: 5 },
            ],
            winner: { ...beta, score: 5 },
            results: match.results!,
          },
        ]}
      />,
    )
    expect(teamName(teamLinks()[0])).toBe(beta.name)
    expect(teamLinks()[0].textContent).toBe(beta.name)
    expect(screen.queryByText('BE')).toBeNull()
    expect(screen.queryByText('AL')).toBeNull()
  })

  it('handles a missing opponent', () => {
    render(
      <MatchesList
        eventId="event"
        teamId="beta"
        matches={[{ ...match, teams: [beta] }]}
      />,
    )
    expect(teamName(teamLinks()[0])).toBe(beta.name)
    expect(screen.getByText('Unknown')).toBeTruthy()
  })

  it('keeps the winner visible for a deleted team without linking it', () => {
    render(
      <MatchesList
        eventId="event"
        teamId="beta"
        matches={[
          { ...match, teams: [alpha, { ...beta, deletedAt: match.createdAt }] },
        ]}
      />,
    )
    expect(teamLinks().map(teamName)).toEqual([alpha.name])
    expect(teamName(screen.getByLabelText('Winner').parentElement!)).toBe(
      beta.name,
    )
  })
})
