// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Event } from '@/app/actions/event'
import {
  excludeInactiveTeams,
  getRepositoryActivity,
  transitionEvent,
} from '@/app/actions/event'
import { getTeamsForEventTable, mapTeamResponse } from '@/app/actions/team'
import type * as TeamActions from '@/app/actions/team'
import { LifecycleControls } from './lifecycle-controls'

vi.mock('@/app/actions/event', () => ({
  transitionEvent: vi.fn().mockResolvedValue({}),
  retryRepository: vi.fn(),
  setTeamExclusion: vi.fn(),
  getRepositoryActivity: vi.fn(),
  excludeInactiveTeams: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/app/actions/team', async (importOriginal) => ({
  ...(await importOriginal<typeof TeamActions>()),
  getTeamsForEventTable: vi.fn(),
}))

const event: Event = {
  id: 'event',
  name: 'Event',
  state: 'SUBMISSIONS_CLOSED',
  startDate: '2020-01-01T10:00:00Z',
  submissionDeadline: '2020-01-01T12:00:00Z',
  scheduledEndDate: '2020-01-01T14:00:00Z',
  endDate: '2020-01-01T14:00:00Z',
  completedAt: null,
  introEnabled: false,
  introLeadMinutes: 15,
  streamUrl: null,
  showtimeStreamUrl: null,
  minTeamSize: 1,
  maxTeamSize: 4,
  currentRound: 0,
  githubOrg: 'core',
  canCreateTeam: true,
  lockedAt: null,
  processQueue: true,
  gamblingEnabled: true,
  maxQueueCredits: 5,
  tournamentAdvancementLimit: null,
  queueCreditIntervalMinutes: 15,
  isPrivate: false,
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

function setup(data = event) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <LifecycleControls event={data} />
    </QueryClientProvider>,
  )
  return client
}

describe('lifecycle controls', () => {
  it('excludes only the inactive teams the admin keeps selected', async () => {
    vi.mocked(getTeamsForEventTable).mockResolvedValue([])
    vi.mocked(getRepositoryActivity).mockResolvedValue([
      { teamId: 'active', teamName: 'Active team', status: 'active' },
      { teamId: 'kept', teamName: 'Kept team', status: 'inactive' },
      { teamId: 'idle', teamName: 'Idle team', status: 'inactive' },
      { teamId: 'unknown', teamName: 'Unknown team', status: 'unknown' },
    ])
    setup()
    fireEvent.click(
      screen.getByRole('button', { name: 'Check repository activity' }),
    )
    await screen.findByRole('checkbox', { name: 'Idle team' })
    expect(screen.queryByRole('checkbox', { name: 'Active team' })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'Unknown team' })).toBeNull()
    screen.getByText(/Unknown team\. They stay in the tournament/)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Kept team' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Exclude selected teams' }),
    )
    await waitFor(() =>
      expect(excludeInactiveTeams).toHaveBeenCalledWith('event', ['idle']),
    )
    await waitFor(() =>
      expect(screen.queryByText('Repository activity')).toBeNull(),
    )
  })

  it('blocks an exclusion that would leave fewer than two teams', async () => {
    vi.mocked(getTeamsForEventTable).mockResolvedValue([])
    vi.mocked(getRepositoryActivity).mockResolvedValue([
      { teamId: 'active', teamName: 'Active team', status: 'active' },
      { teamId: 'idle', teamName: 'Idle team', status: 'inactive' },
    ])
    setup()
    fireEvent.click(
      screen.getByRole('button', { name: 'Check repository activity' }),
    )
    await screen.findByRole('checkbox', { name: 'Idle team' })
    expect(
      screen
        .getByRole('button', { name: 'Exclude selected teams' })
        .hasAttribute('disabled'),
    ).toBe(true)
  })

  it('blocks showcase until every team is locked or excluded', async () => {
    vi.mocked(getTeamsForEventTable).mockResolvedValue([
      mapTeamResponse({
        id: 'team',
        name: 'Pending team',
        repositoryStatus: 'LOCKING',
      }),
    ])
    const client = setup()
    await screen.findByText('Pending team')
    expect(
      screen
        .getByRole('button', { name: 'Start Showtime' })
        .hasAttribute('disabled'),
    ).toBe(true)
    vi.mocked(getTeamsForEventTable).mockResolvedValue([
      mapTeamResponse({
        id: 'team',
        name: 'Pending team',
        repositoryStatus: 'FAILED',
        tournamentExcluded: true,
      }),
    ])
    await client.invalidateQueries()
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: 'Start Showtime' })
          .hasAttribute('disabled'),
      ).toBe(false),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start Showtime' }))
    await waitFor(() =>
      expect(transitionEvent).toHaveBeenCalledWith('event', {
        action: 'showcase',
      }),
    )
  })

  it('requires confirmation to complete without requiring revealed matches', async () => {
    vi.mocked(getTeamsForEventTable).mockResolvedValue([])
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    setup({ ...event, state: 'SHOWCASE' })
    fireEvent.click(screen.getByRole('button', { name: 'Complete event' }))
    expect(transitionEvent).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Complete event' }))
    await waitFor(() =>
      expect(transitionEvent).toHaveBeenCalledWith('event', {
        action: 'complete',
      }),
    )
  })

  it('reopens a completed event beyond its scheduled end using an epoch deadline', async () => {
    vi.mocked(getTeamsForEventTable).mockResolvedValue([])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    setup({ ...event, state: 'COMPLETED', completedAt: event.scheduledEndDate })
    const button = screen.getByRole('button', { name: 'Reopen play' })
    expect(button.hasAttribute('disabled')).toBe(true)
    fireEvent.change(
      screen.getByLabelText('New submission deadline (local time)'),
      { target: { value: '2099-01-01T12:00' } },
    )
    fireEvent.click(button)
    await waitFor(() =>
      expect(transitionEvent).toHaveBeenCalledWith('event', {
        action: 'reopen',
        submissionDeadline: new Date('2099-01-01T12:00').getTime(),
      }),
    )
  })

  it('renders operation controls above the team repository list', async () => {
    vi.mocked(getTeamsForEventTable).mockResolvedValue([
      mapTeamResponse({
        id: 'team',
        name: 'Team Alpha',
        repositoryStatus: 'LOCKED',
      }),
    ])
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    render(
      <QueryClientProvider client={client}>
        <LifecycleControls event={event}>
          <div>Operation Controls Section</div>
        </LifecycleControls>
      </QueryClientProvider>,
    )
    const teamItem = await screen.findByText('Team Alpha')
    const controls = screen.getByText('Operation Controls Section')
    expect(
      controls.compareDocumentPosition(teamItem) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
