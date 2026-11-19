import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import {
  getEventRoles,
  getRoles,
  listRoleUsers,
  ROLE_LABELS,
} from '@/app/actions/roles'
import type { Role, RoleGrant } from '@/app/actions/roles'
import { searchUsers } from '@/app/actions/user'
import type { UserSearchResult } from '@/app/actions/user'
import { Badge } from '@/components/ui/badge'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EVENT_ROLES, GLOBAL_ROLES, RoleEditor } from './role-editor'
import { RoleSearch } from './role-search'

export function UsersTable({
  event,
}: {
  event?: { id: string; name: string }
}) {
  const [search, setSearch] = useState('')
  const [globalRole, setGlobalRole] = useState('')
  const [eventRole, setEventRole] = useState('')
  const [eventFilter, setEventFilter] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(
    null,
  )
  const [searchingAccounts, setSearchingAccounts] = useState(false)
  const users = useQuery({
    queryKey: event ? ['event', event.id, 'users'] : ['admin', 'users'],
    queryFn: () => listRoleUsers(event?.id),
  })
  const roles = useQuery({
    queryKey: event ? ['event', event.id, 'roles'] : ['admin', 'roles'],
    queryFn: () => (event ? getEventRoles(event.id) : getRoles()),
  })
  const grantsByUser = new Map<string, RoleGrant[]>()
  const eventOptions = new Map<string, string>()
  for (const grant of roles.data ?? []) {
    const grants = grantsByUser.get(grant.user.id) ?? []
    grants.push(grant)
    grantsByUser.set(grant.user.id, grants)
    if (grant.event) eventOptions.set(grant.event.id, grant.event.name)
  }

  const term = search.trim().toLocaleLowerCase()
  const filtered = (users.data ?? []).filter((user) => {
    const grants = grantsByUser.get(user.id) ?? []
    const global = grants.filter((grant) => !grant.eventId)
    const scoped = grants.filter(
      (grant) =>
        grant.eventId && (!eventFilter || eventFilter === grant.eventId),
    )
    return (
      [user.name, user.username].some((value) =>
        value?.toLocaleLowerCase().includes(term),
      ) &&
      (!globalRole ||
        (globalRole === 'none'
          ? !global.length
          : global.some((grant) => grant.role === globalRole))) &&
      ((!eventRole && !eventFilter) ||
        (eventRole === 'none'
          ? !scoped.length
          : scoped.some((grant) => !eventRole || grant.role === eventRole)))
    )
  })

  return (
    <section
      aria-label={event ? 'Joined users' : 'Users'}
      className="space-y-4"
    >
      {event && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Joined users</h2>
          <Button
            variant="outline"
            onClick={() => setSearchingAccounts(true)}
            disabled={!roles.data}
          >
            Search all users
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Input
          type="search"
          aria-label="Search users"
          placeholder="Search name or username"
          className="min-w-44 flex-1"
          value={search}
          onChange={(change) => setSearch(change.target.value)}
        />
        {!event && (
          <RoleFilter
            label="Global role"
            roles={GLOBAL_ROLES}
            value={globalRole}
            onChange={setGlobalRole}
          />
        )}
        {!event && (
          <select
            aria-label="Event"
            className="native-select"
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
        <RoleFilter
          label="Event role"
          roles={EVENT_ROLES}
          value={eventRole}
          onChange={setEventRole}
        />
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
        <>
          <p className="text-sm text-muted-foreground" role="status">
            {filtered.length} of {users.data.length} users
          </p>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  {!event && <TableHead>Global roles</TableHead>}
                  <TableHead>Event roles</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Edit roles</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => {
                  const grants = grantsByUser.get(user.id) ?? []
                  const scoped = grants.filter((grant) => grant.eventId)
                  const eventCount = new Set(
                    scoped.map((grant) => grant.eventId),
                  ).size
                  const count = eventCount
                    ? `${eventCount} ${eventCount === 1 ? 'event' : 'events'}`
                    : '—'
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="font-medium">
                          {user.name || user.username}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          @{user.username}
                        </div>
                      </TableCell>
                      {!event && (
                        <TableCell>
                          <RoleBadges
                            grants={grants.filter((grant) => !grant.eventId)}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        {event ? <RoleBadges grants={scoped} /> : count}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit roles for ${user.name || user.username}`}
                          aria-haspopup="dialog"
                          onClick={() => setSelectedUser(user)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!filtered.length && (
                  <TableRow>
                    <TableCell
                      colSpan={event ? 3 : 4}
                      className="py-6 text-center text-muted-foreground"
                    >
                      {event && users.data.length === 0
                        ? 'No users have joined this event.'
                        : 'No users match these filters.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      {searchingAccounts && (
        <Dialog open onOpenChange={setSearchingAccounts}>
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
                setSelectedUser(user)
              }}
            />
          </DialogContent>
        </Dialog>
      )}
      {selectedUser && (
        <RoleEditor
          key={selectedUser.id}
          user={selectedUser}
          grants={grantsByUser.get(selectedUser.id) ?? []}
          event={event}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </section>
  )
}

function RoleFilter({
  label,
  roles,
  value,
  onChange,
}: {
  label: string
  roles: Role[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <select
      aria-label={label}
      className="native-select"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{label}</option>
      {roles.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABELS[role]}
        </option>
      ))}
      <option value="none">No {label.toLowerCase()}</option>
    </select>
  )
}

function RoleBadges({ grants }: { grants: RoleGrant[] }) {
  return grants.length ? (
    <div className="flex flex-wrap gap-1">
      {grants.map((grant) => (
        <Badge key={grant.id} variant="secondary">
          {ROLE_LABELS[grant.role]}
        </Badge>
      ))}
    </div>
  ) : (
    '—'
  )
}
