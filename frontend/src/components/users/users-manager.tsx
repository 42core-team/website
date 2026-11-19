import { useState } from 'react'
import {
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import {
  getEventRoles,
  getRoles,
  grantEventRole,
  grantRole,
  listRoleUsers,
  removeEventRole,
  removeRole,
  roleErrorMessage,
} from '@/app/actions/roles'
import type { Role, RoleGrant } from '@/app/actions/roles'
import { searchUsers } from '@/app/actions/user'
import type { UserSearchResult } from '@/app/actions/user'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { RolePanel, UserAvatar, eventLevel } from './role-panel'
import type { RoleChange, RoleOp } from './role-panel'
import { RoleSearch } from './role-search'

type Chip = 'all' | Role | 'staff' | 'none'
const CHIP_LABELS: Record<Chip, string> = {
  all: 'All',
  ADMIN: 'Admins',
  MODERATOR: 'Moderators',
  PUBLIC_EVENT_CREATOR: 'Public creators',
  PRIVATE_EVENT_CREATOR: 'Private creators',
  staff: 'Event staff',
  none: 'No role',
}
const DOTS: Record<Exclude<Chip, 'all' | 'none'>, string> = {
  ADMIN: 'bg-red-500',
  MODERATOR: 'bg-blue-500',
  PUBLIC_EVENT_CREATOR: 'bg-emerald-500',
  PRIVATE_EVENT_CREATOR: 'bg-amber-500',
  staff: 'bg-violet-500',
}
const ADMIN_CHIPS: Chip[] = [
  'all',
  'ADMIN',
  'MODERATOR',
  'PUBLIC_EVENT_CREATOR',
  'PRIVATE_EVENT_CREATOR',
  'staff',
  'none',
]
const EVENT_CHIPS: Chip[] = ['all', 'ADMIN', 'MODERATOR', 'none']

class RoleChangeError extends Error {
  constructor(
    readonly error: unknown,
    readonly op: RoleOp,
  ) {
    super('Role change failed')
  }
}

/** Runs ops in order and returns the ops that undo them. */
async function applyChange(
  { user, ops }: Pick<RoleChange, 'user' | 'ops'>,
  eventId?: string,
) {
  const inverse: RoleOp[] = []
  for (const op of ops) {
    try {
      if (op.kind === 'grant') {
        const grant = eventId
          ? await grantEventRole(eventId, { userId: user.id, role: op.role })
          : await grantRole({
              userId: user.id,
              role: op.role,
              ...(op.eventId && { eventId: op.eventId }),
            })
        inverse.unshift({ kind: 'remove', grant })
      } else {
        if (eventId) await removeEventRole(eventId, op.grant.id)
        else await removeRole(op.grant.id)
        inverse.unshift({
          kind: 'grant',
          role: op.grant.role,
          eventId: op.grant.eventId,
        })
      }
    } catch (error) {
      // Roll back the steps that went through, so a failed change leaves
      // the user as they were (e.g. not both moderator and admin).
      await applyChange({ user, ops: inverse }, eventId).catch(() => undefined)
      throw new RoleChangeError(error, op)
    }
  }
  return inverse
}

export function UsersManager({
  event,
}: {
  event?: { id: string; name: string }
}) {
  const [search, setSearch] = useState('')
  const [chip, setChip] = useState<Chip>('all')
  const [eventFilterId, setEventFilter] = useState('')
  // Kept as picked, e.g. from "Search all users", and refreshed from the list.
  const [picked, setSelected] = useState<UserSearchResult | null>(null)
  const [searchingAccounts, setSearchingAccounts] = useState(false)
  const client = useQueryClient()
  const users = useQuery({
    queryKey: event ? ['event', event.id, 'users'] : ['admin', 'users'],
    queryFn: () => listRoleUsers(event?.id),
  })
  const roles = useQuery({
    queryKey: event ? ['event', event.id, 'roles'] : ['admin', 'roles'],
    queryFn: () => (event ? getEventRoles(event.id) : getRoles()),
  })
  const pendingUsers = useMutationState({
    filters: { mutationKey: ['role-change'], status: 'pending' },
    select: (mutation) => (mutation.state.variables as RoleChange).user.id,
  })
  const mutation = useMutation({
    mutationKey: ['role-change'],
    mutationFn: (change: RoleChange) => applyChange(change, event?.id),
    onSuccess: (inverse, change) => {
      if (change.undo) toast.success(`Undone: ${change.summary}`)
      else
        toast.success(change.summary, {
          action: {
            label: 'Undo',
            onClick: () =>
              mutation.mutate({ ...change, ops: inverse, undo: true }),
          },
        })
    },
    // Awaited so controls stay disabled until fresh grants arrive; a 404
    // means the user list may be stale too
    onSettled: (_inverse, error) => {
      const cause = error instanceof RoleChangeError ? error.error : error
      const missing = isAxiosError(cause) && cause.response?.status === 404
      return Promise.all([
        client.invalidateQueries({
          queryKey: event
            ? ['event', event.id]
            : missing
              ? ['admin']
              : ['admin', 'roles'],
        }),
        client.invalidateQueries({ queryKey: ['auth', 'session'] }),
      ])
    },
  })
  function select(user: UserSearchResult) {
    mutation.reset()
    setSelected(user)
  }

  const grantsByUser = new Map<string, RoleGrant[]>()
  const eventOptions = new Map<string, string>()
  for (const grant of roles.data ?? []) {
    grantsByUser.set(grant.user.id, [
      ...(grantsByUser.get(grant.user.id) ?? []),
      grant,
    ])
    if (grant.event) eventOptions.set(grant.event.id, grant.event.name)
  }
  // An event whose last staff role was removed drops out of the options.
  const eventFilter = eventOptions.has(eventFilterId) ? eventFilterId : ''
  const selected = users.data?.find((user) => user.id === picked?.id) ?? picked
  // Roles each user counts toward, matching the chips
  function userChips(user: UserSearchResult) {
    const grants = grantsByUser.get(user.id) ?? []
    if (event) {
      const level = eventLevel(grants)
      return new Set<Chip>(['all', level === 'NONE' ? 'none' : level])
    }
    const chips = new Set<Chip>(['all'])
    for (const grant of grants)
      if (!grant.eventId) chips.add(grant.role)
      else if (!eventFilter || grant.eventId === eventFilter) chips.add('staff')
    if (!grants.length) chips.add('none')
    return chips
  }

  const term = search.trim().toLocaleLowerCase()
  const candidates = (users.data ?? [])
    .filter((user) =>
      [user.name, user.username].some((value) =>
        value.toLocaleLowerCase().includes(term),
      ),
    )
    .map((user) => ({ user, chips: userChips(user) }))
    .filter(({ chips }) => !eventFilter || chips.has('staff'))
  const filtered = candidates.filter(({ chips }) => chips.has(chip))

  const selectedError =
    mutation.error instanceof RoleChangeError &&
    mutation.variables?.user.id === selected?.id
      ? roleErrorMessage(
          mutation.error.error,
          mutation.error.op.kind,
          Boolean(
            event ||
            (mutation.error.op.kind === 'grant'
              ? mutation.error.op.eventId
              : mutation.error.op.grant.eventId),
          ),
        )
      : null

  return (
    <section
      aria-label={event ? 'Joined users' : 'Users'}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        {event ? (
          <h2 className="mr-auto text-xl font-semibold">Joined users</h2>
        ) : (
          <h1 className="mr-auto text-3xl font-bold">Users</h1>
        )}
        {event && (
          <Button
            variant="outline"
            onClick={() => setSearchingAccounts(true)}
            disabled={!roles.data}
          >
            Search all users
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Filter by role"
          className="flex flex-wrap gap-2"
        >
          {(event ? EVENT_CHIPS : ADMIN_CHIPS).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={chip === value ? 'default' : 'outline'}
              className="rounded-full"
              aria-pressed={chip === value}
              onClick={() => setChip(value)}
            >
              {value !== 'all' && value !== 'none' && (
                <span
                  aria-hidden
                  className={cn('size-2 rounded-full', DOTS[value])}
                />
              )}
              {CHIP_LABELS[value]}{' '}
              <span className="tabular-nums opacity-70">
                {candidates.filter(({ chips }) => chips.has(value)).length}
              </span>
            </Button>
          ))}
        </div>
        {!event && (
          <select
            aria-label="Event"
            className="ml-auto h-8 max-w-full rounded-md border bg-background px-2 text-sm"
            value={eventFilter}
            onChange={(change) => setEventFilter(change.target.value)}
          >
            <option value="">All events</option>
            {[...eventOptions]
              .sort((a, b) => a[1].localeCompare(b[1]))
              .map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
          </select>
        )}
      </div>
      {users.isError || roles.isError ? (
        <p role="alert">
          Could not load users or roles.{' '}
          <Button
            variant="link"
            onClick={() => {
              if (users.isError) void users.refetch()
              if (roles.isError) void roles.refetch()
            }}
          >
            Retry
          </Button>
        </p>
      ) : users.isPending || roles.isPending ? (
        <Spinner />
      ) : (
        // Both columns share one height on large screens; the list scrolls.
        <div className="grid gap-4 lg:h-[calc(100dvh-14rem)] lg:min-h-[28rem] lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-md border">
            <div className="space-y-1 border-b p-2">
              <Input
                type="search"
                aria-label="Search users"
                placeholder="Search name or username"
                value={search}
                onChange={(change) => setSearch(change.target.value)}
              />
              <p className="px-1 text-xs text-muted-foreground" role="status">
                {filtered.length} of {users.data.length} users
              </p>
            </div>
            <ul
              aria-label="User list"
              className="max-h-[60dvh] min-h-0 flex-1 divide-y overflow-y-auto lg:max-h-none"
            >
              {filtered.map(({ user, chips }) => (
                <li key={user.id}>
                  <button
                    type="button"
                    aria-current={selected?.id === user.id || undefined}
                    onClick={() => select(user)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none',
                      selected?.id === user.id && 'bg-muted',
                    )}
                  >
                    <UserAvatar user={user} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {user.name || user.username}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        @{user.username}
                      </span>
                    </span>
                    <RoleDots chips={chips} />
                  </button>
                </li>
              ))}
              {!filtered.length && (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {event && users.data.length === 0
                    ? 'No users have joined this event.'
                    : 'No users match these filters.'}
                </li>
              )}
            </ul>
          </div>
          <div className="min-h-0 overflow-y-auto rounded-md border p-4">
            {selected ? (
              <RolePanel
                key={selected.id}
                user={selected}
                grants={grantsByUser.get(selected.id) ?? []}
                event={event}
                pending={pendingUsers.includes(selected.id)}
                error={selectedError}
                onChange={(ops, summary) =>
                  mutation.mutate({ user: selected, ops, summary })
                }
              />
            ) : (
              <p className="flex h-full items-center justify-center py-12 text-center text-sm text-muted-foreground">
                Select a user to manage their roles.
              </p>
            )}
          </div>
        </div>
      )}
      {event && (
        <Dialog open={searchingAccounts} onOpenChange={setSearchingAccounts}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Search all users</DialogTitle>
              <DialogDescription>
                Manage event roles for any account, including users who haven’t
                joined.
              </DialogDescription>
            </DialogHeader>
            <RoleSearch
              label="User"
              placeholder="Search name or username"
              minLength={2}
              search={searchUsers}
              renderResult={(user) =>
                `${user.name || user.username} (@${user.username})`
              }
              onSelect={(user) => {
                setSearchingAccounts(false)
                select(user)
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </section>
  )
}

function RoleDots({ chips }: { chips: Set<Chip> }) {
  const roles = [...chips].filter(
    (chip): chip is keyof typeof DOTS => chip in DOTS,
  )
  if (!roles.length) return null
  return (
    <span className="flex gap-1">
      {roles.map((role) => (
        <span
          key={role}
          title={CHIP_LABELS[role]}
          className={cn('size-2 rounded-full', DOTS[role])}
        />
      ))}
      <span className="sr-only">
        {roles.map((role) => CHIP_LABELS[role]).join(', ')}
      </span>
    </span>
  )
}
