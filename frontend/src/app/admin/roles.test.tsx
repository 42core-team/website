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
import { getEventsOverview } from '@/app/actions/event'
import { searchUsers } from '@/app/actions/user'

vi.mock('@/lib/auth', () => ({ useSession: vi.fn() }))
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof Router>()),
  Navigate: () => <p>Redirected</p>,
}))
vi.mock('@/app/actions/event', () => ({ getEventsOverview: vi.fn() }))
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
  vi.mocked(getEventsOverview).mockResolvedValue({
    allEvents: [],
    myEvents: [],
  })
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
    expect(getEventsOverview).not.toHaveBeenCalled()
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
  it('searches users after debounce and grants a global role without eventId', async () => {
    await setup()
    fireEvent.change(screen.getByLabelText('User'), {
      target: { value: 'ada' },
    })
    expect(searchUsers).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Ada (@ada)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Grant role' }))
    await waitFor(() =>
      expect(grantRole).toHaveBeenCalledWith({ userId: 'ada', role: 'ADMIN' }),
    )
    await screen.findByText('Role granted.')
  })
})
