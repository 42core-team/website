// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Router from '@tanstack/react-router'
import type * as Roles from '@/app/actions/roles'
import { Route } from '@/routes/admin/roles'
import { useSession } from '@/lib/auth'
import { getRoles, grantRole, removeRole } from '@/app/actions/roles'
import type { RoleGrant } from '@/app/actions/roles'
import axiosInstance from '@/app/actions/axios'
import { searchUsers } from '@/app/actions/user'

vi.mock('@/lib/auth', () => ({ useSession: vi.fn() }))
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof Router>()),
  Navigate: () => <p>Redirected</p>,
}))
vi.mock('@/app/actions/axios', () => ({ default: { get: vi.fn() } }))
vi.mock('@/app/actions/user', () => ({ searchUsers: vi.fn() }))
vi.mock('@/app/actions/roles', async (original) => ({
  ...(await original<typeof Roles>()),
  getRoles: vi.fn(),
  grantRole: vi.fn(),
  removeRole: vi.fn(),
}))
const user = { id: 'ada', username: 'ada', name: 'Ada', profilePicture: '' }
const globalRole: RoleGrant = {
  id: 'global',
  role: 'ADMIN',
  eventId: null,
  user,
  grantedBy: { id: 'grace', username: 'grace' },
  createdAt: '2026-11-13T12:00:00Z',
}

beforeEach(() => {
  vi.mocked(useSession).mockReturnValue({
    data: {
      user: {
        ...user,
        email: '',
        abilities: {
          admin: true,
          moderator: false,
          createEvent: true,
          createPublicEvent: true,
        },
      },
    },
    status: 'authenticated',
    update: vi.fn(),
  } as unknown as ReturnType<typeof useSession>)
  vi.mocked(getRoles).mockResolvedValue([
    globalRole,
    {
      ...globalRole,
      id: 'scoped',
      role: 'MODERATOR',
      eventId: 'event',
      event: { id: 'event', name: 'Winter Cup' },
    },
  ])
  vi.mocked(axiosInstance.get).mockResolvedValue({ data: [] })
  vi.mocked(searchUsers).mockResolvedValue([user])
  vi.mocked(grantRole).mockResolvedValue(globalRole)
})
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
async function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const Component = Route.options.component!
  await Component.preload?.()
  await act(async () => {
    render(
      <QueryClientProvider client={client}>
        <Component />
      </QueryClientProvider>,
    )
  })
}

describe('roles administration', () => {
  it('redirects users without global admin ability without loading admin data', async () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          ...user,
          email: '',
          abilities: {
            admin: false,
            moderator: true,
            createEvent: true,
            createPublicEvent: false,
          },
        },
      },
      status: 'authenticated',
      update: vi.fn(),
    } as unknown as ReturnType<typeof useSession>)
    await setup()
    expect(await screen.findByText('Redirected')).toBeDefined()
    expect(getRoles).not.toHaveBeenCalled()
    expect(axiosInstance.get).not.toHaveBeenCalled()
  })
  it('groups roles and confirms removal, retaining the last-admin error inline', async () => {
    const error = new AxiosError('Conflict')
    error.response = { status: 409 } as AxiosError['response']
    vi.mocked(removeRole).mockRejectedValue(error)
    await setup()
    await screen.findByText('Winter Cup', { exact: false })
    expect(screen.getByText('Global roles')).toBeDefined()
    expect(screen.getByText('Event roles')).toBeDefined()
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0])
    expect(removeRole).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Remove role' }))
    await screen.findByText("Can't remove the last global admin.")
    expect(removeRole).toHaveBeenCalledWith('global', expect.anything())
  })
  it('reloads the roles when the grant to remove no longer exists', async () => {
    const error = new AxiosError('Not Found')
    error.response = { status: 404 } as AxiosError['response']
    vi.mocked(removeRole).mockRejectedValue(error)
    await setup()
    await screen.findByText('Winter Cup', { exact: false })
    expect(getRoles).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[1])
    fireEvent.click(screen.getByRole('button', { name: 'Remove role' }))
    await screen.findByText(/no longer exists/)
    await waitFor(() => expect(getRoles).toHaveBeenCalledTimes(2))
  })
  it('hides results of an outdated search term while the next one is pending', async () => {
    const grace = { ...user, id: 'grace', username: 'grace', name: 'Grace' }
    vi.mocked(searchUsers).mockImplementation(async (query) =>
      query === 'gr' ? [grace] : [user],
    )
    await setup()
    const input = screen.getByLabelText('User')
    fireEvent.change(input, { target: { value: 'gr' } })
    await screen.findByRole('button', { name: 'Grace (@grace)' })
    fireEvent.change(input, { target: { value: 'ada' } })
    expect(screen.queryByRole('button', { name: 'Grace (@grace)' })).toBeNull()
    await screen.findByRole('button', { name: 'Ada (@ada)' })
    expect(searchUsers).toHaveBeenCalledTimes(2)
  })
  it('queries admin events after debounce and hides stale results', async () => {
    const event = {
      id: 'private',
      name: 'Private Cup',
      isPrivate: true,
      startDate: '2026-11-13T12:00:00Z',
    }
    let finishOldSearch: (value: { data: (typeof event)[] }) => void = () =>
      undefined
    vi.mocked(axiosInstance.get).mockImplementation((_url, config) => {
      const params = config?.params
      const q =
        params && typeof params === 'object' && 'q' in params
          ? params.q
          : undefined
      if (q === 'old') {
        return new Promise((resolve) => {
          finishOldSearch = resolve
        })
      }
      return Promise.resolve({
        data: q === 'cup' ? [event] : [],
      })
    })
    await setup()
    expect(axiosInstance.get).toHaveBeenCalledWith('/admin/events', {
      params: { q: '', limit: 20 },
    })
    const input = screen.getByLabelText('Event (optional)')
    fireEvent.change(input, { target: { value: 'cup' } })
    expect(axiosInstance.get).toHaveBeenCalledTimes(1)
    await screen.findByRole('button', { name: 'Private Cup Private' })
    expect(axiosInstance.get).toHaveBeenLastCalledWith('/admin/events', {
      params: { q: 'cup', limit: 20 },
    })
    fireEvent.change(input, { target: { value: 'old' } })
    expect(
      screen.queryByRole('button', { name: 'Private Cup Private' }),
    ).toBeNull()
    await waitFor(() =>
      expect(axiosInstance.get).toHaveBeenLastCalledWith('/admin/events', {
        params: { q: 'old', limit: 20 },
      }),
    )
    fireEvent.change(input, { target: { value: 'new' } })
    await act(async () => {
      finishOldSearch({ data: [event] })
    })
    expect(
      screen.queryByRole('button', { name: 'Private Cup Private' }),
    ).toBeNull()
    await waitFor(() =>
      expect(axiosInstance.get).toHaveBeenLastCalledWith('/admin/events', {
        params: { q: 'new', limit: 20 },
      }),
    )
    await screen.findByText('No events found.')
  })
  it('retries event search failures and clears a private event back to global', async () => {
    vi.mocked(axiosInstance.get).mockRejectedValueOnce(new Error('Failed'))
    await setup()
    await screen.findByText('Failed to search events.')
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: [
        {
          id: 'private',
          name: 'Private Cup',
          isPrivate: true,
          startDate: '2026-11-13T12:00:00Z',
        },
      ],
    })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Private Cup Private' }),
    )
    await screen.findByText('Selected: Private Cup')
    fireEvent.click(screen.getByRole('button', { name: 'Global role' }))
    expect(screen.queryByText('Selected: Private Cup')).toBeNull()
    expect(
      screen.getByLabelText<HTMLInputElement>('Event (optional)').value,
    ).toBe('')
    fireEvent.change(screen.getByLabelText('User'), {
      target: { value: 'ada' },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Ada (@ada)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Grant role' }))
    await waitFor(() =>
      expect(grantRole).toHaveBeenCalledWith({
        userId: 'ada',
        role: 'MODERATOR',
      }),
    )
  })
  it('grants an event-scoped Moderator role and resets the event picker', async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: [
        {
          id: 'private',
          name: 'Private Cup',
          isPrivate: true,
          startDate: '2026-11-13T12:00:00Z',
        },
      ],
    })
    await setup()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Private Cup Private' }),
    )
    fireEvent.change(screen.getByLabelText('User'), {
      target: { value: 'ada' },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Ada (@ada)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Grant role' }))
    await waitFor(() =>
      expect(grantRole).toHaveBeenCalledWith({
        userId: 'ada',
        role: 'MODERATOR',
        eventId: 'private',
      }),
    )
    await screen.findByText('Role granted.')
    expect(screen.queryByText('Selected: Private Cup')).toBeNull()
    expect(
      screen.getByLabelText<HTMLInputElement>('Event (optional)').value,
    ).toBe('')
  })
  it('searches users after debounce and grants a global role without eventId', async () => {
    await setup()
    expect(screen.getByRole('combobox', { name: 'Role' }).textContent).toBe(
      'Moderator',
    )
    fireEvent.change(screen.getByLabelText('User'), {
      target: { value: 'ada' },
    })
    expect(searchUsers).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Ada (@ada)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Grant role' }))
    await waitFor(() =>
      expect(grantRole).toHaveBeenCalledWith({
        userId: 'ada',
        role: 'MODERATOR',
      }),
    )
    await screen.findByText('Role granted.')
  })
})
