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
import { UsersTable } from '@/components/users/users-table'
import { Route } from '@/routes/admin/roles'
import { useSession } from '@/lib/auth'
import {
  getRoles,
  grantRole,
  removeRole,
  listRoleUsers,
  getEventRoles,
  grantEventRole,
} from '@/app/actions/roles'
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
  listRoleUsers: vi.fn(),
  getEventRoles: vi.fn(),
  grantEventRole: vi.fn(),
  getRoles: vi.fn(),
  grantRole: vi.fn(),
  removeRole: vi.fn(),
}))
const user = { id: 'ada', username: 'ada', name: 'Ada', profilePicture: '' }
const grace = { ...user, id: 'grace', name: 'Grace', username: 'grace' }
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
  vi.mocked(listRoleUsers).mockResolvedValue([user, grace])
  vi.mocked(getEventRoles).mockResolvedValue([])
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
async function setup(event?: { id: string; name: string }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const Component = Route.options.component!
  await Component.preload?.()
  await act(async () => {
    render(
      <QueryClientProvider client={client}>
        {event ? <UsersTable event={event} /> : <Component />}
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
  it('lists users without grants and filters by name and global role', async () => {
    await setup()
    await screen.findByText('Grace')
    fireEvent.change(screen.getByLabelText('Global role'), {
      target: { value: 'none' },
    })
    expect(screen.queryByText('Ada')).toBeNull()
    expect(screen.getByText('Grace')).toBeDefined()
    fireEvent.change(screen.getByLabelText('Search users'), {
      target: { value: 'ada' },
    })
    expect(screen.getByText('No users match these filters.')).toBeDefined()
  })

  async function editAda() {
    fireEvent.click(
      await screen.findByRole('button', { name: 'Edit roles for Ada' }),
    )
  }

  it('confirms removal separately and retains the last-admin error inline', async () => {
    const error = new AxiosError('Conflict')
    error.response = { status: 409 } as AxiosError['response']
    vi.mocked(removeRole).mockRejectedValue(error)
    await setup()
    await editAda()
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Admin global role' }),
    )
    expect(screen.queryByRole('button', { name: 'Add global role' })).toBeNull()
    expect(removeRole).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Remove role' }))
    await screen.findByText("Can't remove the last global admin.")
    expect(removeRole).toHaveBeenCalledWith('global')
  })

  it('refreshes roles when an assignment no longer exists', async () => {
    const error = new AxiosError('Not Found')
    error.response = { status: 404 } as AxiosError['response']
    vi.mocked(removeRole).mockRejectedValue(error)
    await setup()
    await editAda()
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Moderator for Winter Cup' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove role' }))
    await screen.findByText(/no longer exists/)
    await waitFor(() => expect(getRoles).toHaveBeenCalledTimes(2))
  })

  it('grants a global role from the selected user’s editor', async () => {
    await setup()
    await editAda()
    fireEvent.click(screen.getByRole('button', { name: 'Add global role' }))
    expect(axiosInstance.get).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'MODERATOR' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Grant role' }))
    await waitFor(() =>
      expect(grantRole).toHaveBeenCalledWith({
        userId: 'ada',
        role: 'MODERATOR',
      }),
    )
    await screen.findByRole('button', { name: 'Add global role' })
  })

  it('searches events after debounce and preserves role selection when changing the event', async () => {
    const event = {
      id: 'private',
      name: 'Private Cup',
      isPrivate: true,
      startDate: '2026-11-13T12:00:00Z',
    }
    vi.mocked(axiosInstance.get).mockImplementation(async (_url, config) => ({
      data:
        config?.params &&
        typeof config.params === 'object' &&
        'q' in config.params &&
        config.params.q === 'cup'
          ? [event]
          : [],
    }))
    await setup()
    await editAda()
    fireEvent.click(screen.getByRole('button', { name: 'Add event role' }))
    const input = screen.getByPlaceholderText('Search events by name')
    fireEvent.change(input, { target: { value: 'cup' } })
    const result = await screen.findByRole('button', {
      name: 'Private Cup Private',
    })
    expect(axiosInstance.get).toHaveBeenLastCalledWith('/admin/events', {
      params: { q: 'cup', limit: 20 },
    })
    fireEvent.change(input, { target: { value: 'other' } })
    expect(
      screen.queryByRole('button', { name: 'Private Cup Private' }),
    ).toBeNull()
    fireEvent.change(input, { target: { value: 'cup' } })
    fireEvent.click(
      await screen.findByRole('button', { name: 'Private Cup Private' }),
    )
    expect(result.textContent).toContain('Private Cup')
    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'MODERATOR' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(screen.getByLabelText<HTMLSelectElement>('Role').value).toBe(
      'MODERATOR',
    )
    fireEvent.change(screen.getByPlaceholderText('Search events by name'), {
      target: { value: 'cup' },
    })
    fireEvent.click(
      await screen.findByRole('button', { name: 'Private Cup Private' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Grant role' }))
    await waitFor(() =>
      expect(grantRole).toHaveBeenCalledWith({
        userId: 'ada',
        role: 'MODERATOR',
        eventId: 'private',
      }),
    )
  })

  it('keeps the event table joined-only and finds unjoined accounts through global search', async () => {
    vi.mocked(listRoleUsers).mockResolvedValue([user])
    vi.mocked(searchUsers).mockResolvedValue([grace])
    await setup({ id: 'winter', name: 'Winter Cup' })
    await screen.findByText('Ada')
    expect(listRoleUsers).toHaveBeenCalledWith('winter')
    expect(screen.queryByText('Grace')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Search all users' }))
    fireEvent.change(screen.getByLabelText('User'), { target: { value: 'gr' } })
    fireEvent.click(
      await screen.findByRole('button', { name: 'Grace (@grace)' }),
    )
    await screen.findByRole('heading', { name: 'Edit roles for Grace' })
    expect(screen.queryByText('Global roles')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add event role' }))
    expect(screen.queryByPlaceholderText('Search events by name')).toBeNull()
    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'MODERATOR' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Grant role' }))
    await waitFor(() =>
      expect(grantEventRole).toHaveBeenCalledWith('winter', {
        userId: 'grace',
        role: 'MODERATOR',
      }),
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Done' }))
    expect(screen.queryByText('Grace')).toBeNull()
  })
})
