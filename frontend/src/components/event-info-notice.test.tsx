// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { joinEvent } from '@/app/actions/event'
import EventInfoNotice from '@/components/event-info-notice'

const { navigate, toastError } = vi.hoisted(() => ({
  navigate: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))
vi.mock('@/app/actions/event', () => ({ joinEvent: vi.fn() }))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: toastError },
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderNotice() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  queryClient.setQueryData(
    ['event', 'private-event', 'is-user-registered'],
    false,
  )
  queryClient.setQueryData(['events', 'overview'], {
    myEvents: [],
    allEvents: [],
  })
  render(
    <QueryClientProvider client={queryClient}>
      <EventInfoNotice
        userId="user"
        eventId="private-event"
        startDate="2020-01-01T00:00:00Z"
        isPrivate
        isUserRegistered={false}
      />
    </QueryClientProvider>,
  )
  return queryClient
}

describe('joining a private event', () => {
  it('waits for a successful join before updating registration and navigating to My Team', async () => {
    let finishJoin!: () => void
    vi.mocked(joinEvent).mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          finishJoin = () => resolve(true)
        }),
    )
    const queryClient = renderNotice()

    fireEvent.click(screen.getByRole('button', { name: 'Join Event' }))
    await waitFor(() => expect(joinEvent).toHaveBeenCalledWith('private-event'))
    expect(navigate).not.toHaveBeenCalled()
    expect(
      queryClient.getQueryState(['events', 'overview'])?.isInvalidated,
    ).toBe(false)
    expect(
      queryClient.getQueryData([
        'event',
        'private-event',
        'is-user-registered',
      ]),
    ).toBe(false)

    finishJoin()

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/events/$id/my-team',
        params: { id: 'private-event' },
      }),
    )
    expect(
      queryClient.getQueryData([
        'event',
        'private-event',
        'is-user-registered',
      ]),
    ).toBe(true)
    expect(
      queryClient.getQueryState(['events', 'overview'])?.isInvalidated,
    ).toBe(true)
  })

  it('stays on the current page when joining fails', async () => {
    vi.mocked(joinEvent).mockRejectedValue(new Error('Not allowed to join'))
    const queryClient = renderNotice()

    fireEvent.click(screen.getByRole('button', { name: 'Join Event' }))

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Not allowed to join'),
    )
    expect(navigate).not.toHaveBeenCalled()
    expect(
      queryClient.getQueryState(['events', 'overview'])?.isInvalidated,
    ).toBe(false)
    expect(
      queryClient.getQueryData([
        'event',
        'private-event',
        'is-user-registered',
      ]),
    ).toBe(false)
  })
})
