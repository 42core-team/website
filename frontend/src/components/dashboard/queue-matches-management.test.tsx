// @vitest-environment jsdom
import type { AnchorHTMLAttributes } from 'react'
import type { QueueMatch } from '@/app/actions/tournament-model'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAllQueueMatches } from '@/app/actions/tournament'
import { MatchPhase, MatchState } from '@/app/actions/tournament-model'
import { QueueMatchesManagement } from './queue-matches-management'

vi.mock('@/app/actions/tournament', () => ({
  getAllQueueMatches: vi.fn(),
}))
vi.mock('@/components/app-link', () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}))

const match: QueueMatch = {
  id: 'match',
  state: MatchState.FINISHED,
  phase: MatchPhase.QUEUE,
  createdAt: '2026-10-01T12:00:00Z',
  teams: [
    { id: 'alpha', name: 'Alpha' },
    { id: 'beta', name: 'Beta' },
  ],
}

function renderManagement() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <QueueMatchesManagement eventId="event" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(getAllQueueMatches).mockReset()
  vi.mocked(getAllQueueMatches).mockResolvedValue({
    matches: [match],
    total: 45,
    page: 1,
    pageSize: 20,
  })
})
afterEach(cleanup)

describe('QueueMatchesManagement', () => {
  it('moves between pages and stops at the last one', async () => {
    renderManagement()

    expect(await screen.findByText('Page 1 of 3')).toBeTruthy()
    expect(screen.getByText('Alpha')).toBeTruthy()
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Previous' })
        .disabled,
    ).toBe(true)

    const next = screen.getByRole<HTMLButtonElement>('button', { name: 'Next' })
    fireEvent.click(next)
    expect(await screen.findByText('Page 2 of 3')).toBeTruthy()
    fireEvent.click(next)
    expect(await screen.findByText('Page 3 of 3')).toBeTruthy()
    expect(next.disabled).toBe(true)
    expect(getAllQueueMatches).toHaveBeenLastCalledWith('event', 3, 20, '')
  })

  it('returns to the first page when searching', async () => {
    renderManagement()

    fireEvent.click(await screen.findByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Page 2 of 3')).toBeTruthy()

    fireEvent.change(screen.getByLabelText(/search queue matches/i), {
      target: { value: '  alpha ' },
    })

    await waitFor(() =>
      expect(getAllQueueMatches).toHaveBeenLastCalledWith(
        'event',
        1,
        20,
        'alpha',
      ),
    )
  })

  it('recovers when Next is clicked before a narrower search applies', async () => {
    vi.mocked(getAllQueueMatches).mockImplementation(
      async (_eventId, page, pageSize, search) => {
        const total = search ? 1 : 45
        return {
          matches: page <= Math.ceil(total / pageSize) ? [match] : [],
          total,
          page,
          pageSize,
        }
      },
    )
    renderManagement()

    const next = await screen.findByRole('button', { name: 'Next' })
    fireEvent.change(screen.getByLabelText(/search queue matches/i), {
      target: { value: 'alpha' },
    })
    fireEvent.click(next)

    await waitFor(() =>
      expect(getAllQueueMatches).toHaveBeenLastCalledWith(
        'event',
        1,
        20,
        'alpha',
      ),
    )
    expect(await screen.findByText('Alpha')).toBeTruthy()
    expect(screen.queryByText('No matches found')).toBeNull()
  })

  it('shows loading instead of an empty result while correcting the page', async () => {
    let finishFirstPage = () => {}
    vi.mocked(getAllQueueMatches).mockImplementation(
      async (_eventId, page, pageSize, search) => {
        if (!search) return { matches: [match], total: 45, page, pageSize }
        if (page > 1) return { matches: [], total: 1, page, pageSize }
        await new Promise<void>((resolve) => {
          finishFirstPage = resolve
        })
        return { matches: [match], total: 1, page, pageSize }
      },
    )
    renderManagement()

    const next = await screen.findByRole('button', { name: 'Next' })
    fireEvent.change(screen.getByLabelText(/search queue matches/i), {
      target: { value: 'alpha' },
    })
    fireEvent.click(next)

    await waitFor(() =>
      expect(getAllQueueMatches).toHaveBeenLastCalledWith(
        'event',
        1,
        20,
        'alpha',
      ),
    )
    expect(screen.queryByText('No matches found')).toBeNull()

    finishFirstPage()
    expect(await screen.findByText('Alpha')).toBeTruthy()
  })

  it('shows an empty search without pagination', async () => {
    vi.mocked(getAllQueueMatches).mockResolvedValue({
      matches: [],
      total: 0,
      page: 1,
      pageSize: 20,
    })
    renderManagement()

    fireEvent.change(screen.getByLabelText(/search queue matches/i), {
      target: { value: 'nobody' },
    })

    expect(await screen.findByText('No matches found')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
  })
})
