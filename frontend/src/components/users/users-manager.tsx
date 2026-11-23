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
import { useHistoryIndex, useSearchParam } from '@/hooks/useSearchParam'
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
import {
  Dot,
  FilterChips,
  ListEmpty,
  ListRow,
  RowText,
  listDetailGrid,
} from '@/components/admin/list-detail'
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
  ADMIN: 'bg-role-admin',
  MODERATOR: 'bg-role-moderator',
  PUBLIC_EVENT_CREATOR: 'bg-role-public-creator',
  PRIVATE_EVENT_CREATOR: 'bg-role-private-creator',
  staff: 'bg-role-staff',
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
  // The filters and the selected user live in the URL, so Back and shared
  // links keep them. The search box keeps a draft while typing, since the URL
  // updates after the keystroke, and takes the URL's text on Back or Forward.
  const [query, setQuery] = useSearchParam('q')
  const historyIndex = useHistoryIndex()
  const [draft, setDraft] = useState({ text: query ?? '', historyIndex })
  if (draft.historyIndex !== historyIndex)
    setDraft({ text: query ?? '', historyIndex })
  const search = draft.text
  const [chipParam, setChip] = useSearchParam('role')
  const chipOptions = event ? EVENT_CHIPS : ADMIN_CHIPS
  const chip = chipOptions.find((option) => option === chipParam) ?? 'all'
  const [eventFilterParam, setEventFilter] = useSearchParam('event')
  const [selectedId, setSelectedId] = useSearchParam('user')
  // A user picked from "Search all users" may not be in the list yet.
  const [picked, setPicked] = useState<UserSearchResult | null>(null)
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
    setPicked(user)
    setSelectedId(user.id)
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
  const eventFilter =
    eventFilterParam && eventOptions.has(eventFilterParam)
      ? eventFilterParam
      : ''
  // Someone given a role through "Search all users" may not have joined.
  const selected =
    users.data?.find((user) => user.id === selectedId) ??
    roles.data?.find((grant) => grant.user.id === selectedId)?.user ??
    (picked?.id === selectedId ? picked : null)
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
        <FilterChips
          label="Filter by role"
          options={chipOptions}
          value={chip}
          onChange={(value) => setChip(value === 'all' ? null : value)}
          labels={CHIP_LABELS}
          dots={DOTS}
          count={(value) =>
            candidates.filter(({ chips }) => chips.has(value)).length
          }
        />
        {!event && (
          <select
            aria-label="Event"
            className="ml-auto h-8 max-w-full rounded-md border bg-background px-2 text-sm"
            value={eventFilter}
            onChange={(change) => setEventFilter(change.target.value || null)}
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
        <div
          className={cn(
            listDetailGrid,
            'lg:h-[calc(100dvh-14rem)] lg:min-h-[28rem]',
          )}
        >
          <div className="flex min-h-0 flex-col overflow-hidden rounded-md border">
            <div className="space-y-1 border-b p-2">
              <Input
                type="search"
                aria-label="Search users"
                placeholder="Search name or username"
                value={search}
                onChange={(change) => {
                  setDraft({ text: change.target.value, historyIndex })
                  setQuery(change.target.value || null)
                }}
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
                <ListRow
                  key={user.id}
                  selected={selected?.id === user.id}
                  onSelect={() => select(user)}
                >
                  <UserAvatar user={user} />
                  <RowText
                    title={user.name || user.username}
                    detail={`@${user.username}`}
                  />
                  <RoleDots chips={chips} />
                </ListRow>
              ))}
              {!filtered.length && (
                <ListEmpty>
                  {event && users.data.length === 0
                    ? 'No users have joined this event.'
                    : 'No users match these filters.'}
                </ListEmpty>
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
        <span key={role} title={CHIP_LABELS[role]}>
          <Dot className={DOTS[role]} />
        </span>
      ))}
      <span className="sr-only">
        {roles.map((role) => CHIP_LABELS[role]).join(', ')}
      </span>
    </span>
  )
}
