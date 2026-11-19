// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Router from '@tanstack/react-router'
import type * as Roles from '@/app/actions/roles'
import { UsersManager } from '@/components/users/users-manager'
import { Route } from '@/routes/admin/roles'
import { useSession } from '@/lib/auth'
import {
  getRoles,
  grantRole,
  removeRole,
  listRoleUsers,
  getEventRoles,
  grantEventRole,
  removeEventRole,
} from '@/app/actions/roles'
import type { RoleGrant } from '@/app/actions/roles'
import axiosInstance from '@/app/actions/axios'
import { searchUsers } from '@/app/actions/user'

vi.mock('@/lib/auth', () => ({ useSession: vi.fn() }))
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof Router>()),
  Navigate: () => <p>Redirected</p>,
  Link: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string
    params: { username: string }
    children: React.ReactNode
  }) => (
    <a href={to.replace('$username', params.username)} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))
vi.mock('@/app/actions/axios', () => ({ default: { get: vi.fn() } }))
vi.mock('@/app/actions/user', () => ({ searchUsers: vi.fn() }))
vi.mock('@/app/actions/roles', async (original) => ({
  ...(await original<typeof Roles>()),
  listRoleUsers: vi.fn(),
  getEventRoles: vi.fn(),
  grantEventRole: vi.fn(),
  removeEventRole: vi.fn(),
  getRoles: vi.fn(),
  grantRole: vi.fn(),
  removeRole: vi.fn(),
}))
const user = { id: 'ada', username: 'ada', name: 'Ada', profilePicture: '' }
const grace = { ...user, id: 'grace', name: 'Grace', username: 'grace' }
const linus = { ...user, id: 'linus', name: 'Linus', username: 'linus' }
const globalRole: RoleGrant = {
  id: 'global',
  role: 'ADMIN',
  eventId: null,
  user,
  createdAt: '2026-11-13T12:00:00Z',
}
const scopedRole: RoleGrant = {
  ...globalRole,
  id: 'scoped',
  role: 'MODERATOR',
  eventId: 'event',
  event: { id: 'event', name: 'Winter Cup' },
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
  vi.mocked(listRoleUsers).mockResolvedValue([user, grace, linus])
  vi.mocked(getEventRoles).mockResolvedValue([])
  vi.mocked(getRoles).mockResolvedValue([
    globalRole,
    scopedRole,
    { ...globalRole, id: 'linus-mod', role: 'MODERATOR', user: linus },
  ])
  vi.mocked(axiosInstance.get).mockResolvedValue({ data: [] })
  vi.mocked(searchUsers).mockResolvedValue([user])
  vi.mocked(grantRole).mockImplementation(async (params) => ({
    ...globalRole,
    id: `new-${params.role}`,
    role: params.role,
    eventId: params.eventId ?? null,
  }))
  vi.mocked(removeRole).mockResolvedValue()
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
        {event ? <UsersManager event={event} /> : <Component />}
      </QueryClientProvider>,
    )
  })
}
const list = () => within(screen.getByRole('list', { name: 'User list' }))
async function selectUser(name: string) {
  await screen.findByText('Grace')
  fireEvent.click(list().getByRole('button', { name: new RegExp(name) }))
  await screen.findByRole('heading', { name })
}
function lastUndo() {
  const options = vi.mocked(toast.success).mock.lastCall?.[1] as {
    action: { label: string; onClick: () => void }
  }
  expect(options.action.label).toBe('Undo')
  return options.action.onClick
}
function httpError(status: number) {
  const error = new AxiosError('Failed')
  error.response = { status } as AxiosError['response']
  return error
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

  it('counts and filters users with single-select role chips', async () => {
    await setup()
    await screen.findByText('Grace')
    const chips = within(screen.getByRole('group', { name: 'Filter by role' }))
    expect(
      chips.getAllByRole('button').map((chip) => chip.textContent),
    ).toEqual([
      'All 3',
      'Admins 1',
      'Moderators 1',
      'Public creators 0',
      'Private creators 0',
      'Event staff 1',
      'No role 1',
    ])
    expect(
      chips.getByRole('button', { name: 'All 3' }).getAttribute('aria-pressed'),
    ).toBe('true')
    fireEvent.click(chips.getByRole('button', { name: 'No role 1' }))
    expect(
      chips
        .getByRole('button', { name: 'No role 1' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      chips.getByRole('button', { name: 'All 3' }).getAttribute('aria-pressed'),
    ).toBe('false')
    expect(list().queryByText('Ada')).toBeNull()
    expect(list().getByText('Grace')).toBeDefined()
    fireEvent.click(chips.getByRole('button', { name: 'Moderators 1' }))
    expect(list().getByText('Linus')).toBeDefined()
    expect(list().queryByText('Grace')).toBeNull()
    fireEvent.click(chips.getByRole('button', { name: 'All 3' }))
    fireEvent.change(screen.getByLabelText('Event'), {
      target: { value: 'event' },
    })
    expect(list().getAllByRole('button')).toHaveLength(1)
    expect(chips.getByRole('button', { name: 'All 1' })).toBeDefined()
    fireEvent.change(screen.getByLabelText('Event'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Search users'), {
      target: { value: 'zzz' },
    })
    expect(screen.getByText('No users match these filters.')).toBeDefined()
  })

  it('shows the selected user’s roles in the detail panel', async () => {
    await setup()
    expect(
      await screen.findByText('Select a user to manage their roles.'),
    ).toBeDefined()
    await selectUser('Ada')
    expect(
      list().getByRole('button', { name: /Ada/ }).getAttribute('aria-current'),
    ).toBe('true')
    expect(
      screen.getByRole('link', { name: 'View profile' }).getAttribute('href'),
    ).toBe('/users/ada')
    expect(
      screen
        .getByRole('switch', { name: 'Admin' })
        .getAttribute('aria-checked'),
    ).toBe('true')
    expect(
      screen
        .getByRole('switch', { name: 'Moderator' })
        .getAttribute('aria-checked'),
    ).toBe('false')
    const winter = screen.getByRole('group', {
      name: 'Role in Winter Cup',
    })
    expect(
      within(winter)
        .getByRole('button', { name: 'Moderator' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('toggles a global role and undoes it', async () => {
    await setup()
    await selectUser('Ada')
    fireEvent.click(screen.getByRole('switch', { name: 'Moderator' }))
    await waitFor(() =>
      expect(grantRole).toHaveBeenCalledWith({
        userId: 'ada',
        role: 'MODERATOR',
      }),
    )
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'Granted Moderator to Ada',
        expect.anything(),
      ),
    )
    act(() => lastUndo()())
    await waitFor(() =>
      expect(removeRole).toHaveBeenCalledWith('new-MODERATOR'),
    )
  })

  it('removes a global role when switched off', async () => {
    await setup()
    await selectUser('Linus')
    fireEvent.click(screen.getByRole('switch', { name: 'Moderator' }))
    await waitFor(() => expect(removeRole).toHaveBeenCalledWith('linus-mod'))
  })

  it('promotes an event moderator by granting Admin before removing Moderator, and undoes in reverse', async () => {
    await setup()
    await selectUser('Ada')
    const winter = screen.getByRole('group', {
      name: 'Role in Winter Cup',
    })
    fireEvent.click(within(winter).getByRole('button', { name: 'Admin' }))
    await waitFor(() => expect(removeRole).toHaveBeenCalledWith('scoped'))
    expect(grantRole).toHaveBeenCalledWith({
      userId: 'ada',
      role: 'ADMIN',
      eventId: 'event',
    })
    expect(vi.mocked(grantRole).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(removeRole).mock.invocationCallOrder[0],
    )
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    vi.mocked(grantRole).mockClear()
    vi.mocked(removeRole).mockClear()
    act(() => lastUndo()())
    await waitFor(() => expect(removeRole).toHaveBeenCalledWith('new-ADMIN'))
    expect(grantRole).toHaveBeenCalledWith({
      userId: 'ada',
      role: 'MODERATOR',
      eventId: 'event',
    })
    expect(vi.mocked(grantRole).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(removeRole).mock.invocationCallOrder[0],
    )
  })

  it('rolls back a half-applied change when a later step fails', async () => {
    vi.mocked(removeRole)
      .mockRejectedValueOnce(httpError(409))
      .mockResolvedValue(undefined)
    await setup()
    await selectUser('Ada')
    const winter = screen.getByRole('group', {
      name: 'Role in Winter Cup',
    })
    fireEvent.click(within(winter).getByRole('button', { name: 'Admin' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    // The Admin grant that went through is removed again.
    expect(removeRole).toHaveBeenNthCalledWith(1, 'scoped')
    expect(removeRole).toHaveBeenNthCalledWith(2, 'new-ADMIN')
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('keeps controls focusable but inert while a change saves', async () => {
    vi.mocked(grantRole).mockReturnValue(new Promise(() => undefined))
    await setup()
    await selectUser('Ada')
    const winter = screen.getByRole('group', { name: 'Role in Winter Cup' })
    const admin = within(winter).getByRole('button', { name: 'Admin' })
    admin.focus()
    fireEvent.click(admin)
    await waitFor(() =>
      expect(admin.getAttribute('aria-disabled')).toBe('true'),
    )
    expect(admin.hasAttribute('disabled')).toBe(false)
    expect(document.activeElement).toBe(admin)
    fireEvent.click(within(winter).getByRole('button', { name: 'None' }))
    expect(removeRole).not.toHaveBeenCalled()
    expect(grantRole).toHaveBeenCalledTimes(1)
  })

  it('removes every grant for an event when set to None', async () => {
    vi.mocked(getRoles).mockResolvedValue([
      scopedRole,
      { ...scopedRole, id: 'scoped-admin', role: 'ADMIN' },
      { ...globalRole, user: grace },
    ])
    await setup()
    await selectUser('Ada')
    const winter = screen.getByRole('group', {
      name: 'Role in Winter Cup',
    })
    expect(
      within(winter)
        .getByRole('button', { name: 'Admin' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    fireEvent.click(within(winter).getByRole('button', { name: 'None' }))
    await waitFor(() => expect(removeRole).toHaveBeenCalledTimes(2))
    expect(removeRole).toHaveBeenCalledWith('scoped')
    expect(removeRole).toHaveBeenCalledWith('scoped-admin')
    expect(grantRole).not.toHaveBeenCalled()
  })

  it('shows the last-admin refusal inline', async () => {
    vi.mocked(removeRole).mockRejectedValue(httpError(409))
    await setup()
    await selectUser('Ada')
    fireEvent.click(screen.getByRole('switch', { name: 'Admin' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      "Can't remove the last global admin.",
    )
    expect(removeRole).toHaveBeenCalledWith('global')
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('refreshes roles when an assignment no longer exists', async () => {
    vi.mocked(removeRole).mockRejectedValue(httpError(404))
    await setup()
    await selectUser('Ada')
    const winter = screen.getByRole('group', {
      name: 'Role in Winter Cup',
    })
    fireEvent.click(within(winter).getByRole('button', { name: 'None' }))
    await screen.findByText(/no longer exists/)
    await waitFor(() => expect(getRoles).toHaveBeenCalledTimes(2))
  })

  it('adds an event row from the inline search and grants on selection', async () => {
    const event = {
      id: 'private',
      name: 'Private Cup',
      isPrivate: true,
      startDate: '2026-11-13T12:00:00Z',
    }
    vi.mocked(axiosInstance.get).mockResolvedValue({ data: [event] })
    await setup()
    await selectUser('Grace')
    fireEvent.click(screen.getByRole('button', { name: 'Add to event' }))
    fireEvent.change(screen.getByLabelText('Add to event…'), {
      target: { value: 'cup' },
    })
    fireEvent.click(
      await screen.findByRole('button', { name: /^Private Cup Private/ }),
    )
    expect(axiosInstance.get).toHaveBeenLastCalledWith('/admin/events', {
      params: { q: 'cup', limit: 20 },
    })
    const row = screen.getByRole('group', { name: 'Role in Private Cup' })
    expect(
      within(row)
        .getByRole('button', { name: 'None' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    fireEvent.click(within(row).getByRole('button', { name: 'Moderator' }))
    await waitFor(() =>
      expect(grantRole).toHaveBeenCalledWith({
        userId: 'grace',
        role: 'MODERATOR',
        eventId: 'private',
      }),
    )
  })

  it('limits the event dashboard to the current event and finds unjoined accounts', async () => {
    vi.mocked(listRoleUsers).mockResolvedValue([user])
    vi.mocked(getEventRoles).mockResolvedValue([
      { ...scopedRole, eventId: 'winter', event: undefined },
    ])
    vi.mocked(searchUsers).mockResolvedValue([grace])
    vi.mocked(grantEventRole).mockResolvedValue({
      ...scopedRole,
      id: 'grace-mod',
      user: grace,
    })
    await setup({ id: 'winter', name: 'Winter Cup' })
    await screen.findByText('Ada')
    expect(listRoleUsers).toHaveBeenCalledWith('winter')
    const chips = within(screen.getByRole('group', { name: 'Filter by role' }))
    expect(
      chips.getAllByRole('button').map((chip) => chip.textContent),
    ).toEqual(['All 1', 'Admins 0', 'Moderators 1', 'No role 0'])
    fireEvent.click(screen.getByRole('button', { name: 'Search all users' }))
    fireEvent.change(screen.getByLabelText('User'), { target: { value: 'gr' } })
    fireEvent.click(
      await screen.findByRole('button', { name: 'Grace (@grace)' }),
    )
    await screen.findByRole('heading', { name: 'Grace' })
    expect(screen.queryByText('Global roles')).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByLabelText('Add to event…')).toBeNull()
    expect(screen.getAllByRole('group', { name: /^Role in/ })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Moderator' }))
    await waitFor(() =>
      expect(grantEventRole).toHaveBeenCalledWith('winter', {
        userId: 'grace',
        role: 'MODERATOR',
      }),
    )
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    act(() => lastUndo()())
    await waitFor(() =>
      expect(removeEventRole).toHaveBeenCalledWith('winter', 'grace-mod'),
    )
    expect(list().queryByText('Grace')).toBeNull()
  })
})
