import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { z } from 'zod'
import { getEventsOverview } from '@/app/actions/event'
import {
  getRoles,
  grantRole,
  removeRole,
  ROLE_LABELS,
  roleErrorMessage,
} from '@/app/actions/roles'
import type { GrantRoleParams, Role, RoleGrant } from '@/app/actions/roles'
import { searchUsers } from '@/app/actions/user'
import type { UserSearchResult } from '@/app/actions/user'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useSession } from '@/lib/auth'

export const Route = createFileRoute('/admin/roles')({ component: RolesRoute })

function RolesRoute() {
  const { data: session, status } = useSession()
  if (status === 'loading')
    return (
      <main className="flex justify-center p-16">
        <Spinner />
      </main>
    )
  if (!session?.user.abilities.admin) return <Navigate to="/" replace />
  return <RolesPage />
}

const schema = z.object({
  userId: z.string().min(1, 'Choose a user.'),
  role: z.enum([
    'ADMIN',
    'MODERATOR',
    'PUBLIC_EVENT_CREATOR',
    'PRIVATE_EVENT_CREATOR',
  ]),
  eventId: z.string(),
})

function RolesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(
    null,
  )
  // Kept after closing so the dialog text does not blank out while it animates.
  const [removal, setRemoval] = useState<RoleGrant | null>(null)
  const [removalOpen, setRemovalOpen] = useState(false)
  const debouncedSearch = useDebouncedValue(search.trim())
  const roles = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => getRoles(),
  })
  const events = useQuery({
    queryKey: ['admin', 'role-events'],
    queryFn: async () => {
      const { allEvents, myEvents } = await getEventsOverview()
      return Array.from(
        new Map(
          [...allEvents, ...myEvents].map((event) => [event.id, event]),
        ).values(),
      )
    },
  })
  const users = useQuery({
    queryKey: ['admin', 'role-users', debouncedSearch],
    queryFn: () => searchUsers(debouncedSearch),
    enabled: debouncedSearch.length >= 2 && !selectedUser,
  })
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] }),
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] }),
      queryClient.invalidateQueries({ queryKey: ['event'] }),
    ])
  }
  // A 403 means this admin lost the role, so reload the session to leave the
  // page; a 404 means a user, event or grant is gone, so reload the lists.
  const onRoleError = (error: Error) => {
    const status = isAxiosError(error) ? error.response?.status : undefined
    if (status === 403)
      void queryClient.invalidateQueries({ queryKey: ['auth', 'session'] })
    if (status === 404)
      void queryClient.invalidateQueries({ queryKey: ['admin'] })
  }
  const grant = useMutation({
    mutationFn: (params: GrantRoleParams) => grantRole(params),
    onSuccess: async () => {
      form.reset()
      setSelectedUser(null)
      setSearch('')
      await refresh()
    },
    onError: onRoleError,
  })
  const remove = useMutation({
    mutationFn: removeRole,
    onSuccess: async () => {
      setRemovalOpen(false)
      await refresh()
    },
    onError: onRoleError,
  })
  const form = useForm({
    defaultValues: { userId: '', role: 'ADMIN' as Role, eventId: '' },
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      const scoped = value.role === 'ADMIN' || value.role === 'MODERATOR'
      await grant
        .mutateAsync({
          userId: value.userId,
          role: value.role,
          ...(scoped && value.eventId ? { eventId: value.eventId } : {}),
        })
        .catch(() => undefined)
    },
  })

  return (
    <main className="container mx-auto space-y-6 px-4 py-8">
      <h1 className="text-3xl font-bold">Roles and authorization</h1>
      <Card>
        <CardHeader>
          <CardTitle>Grant role</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="max-w-xl space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="role-user">User</Label>
              <Input
                id="role-user"
                placeholder="Search by name or username"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setSelectedUser(null)
                  form.setFieldValue('userId', '')
                  grant.reset()
                }}
              />
              {selectedUser ? (
                <p className="text-sm">
                  Selected: {selectedUser.name || selectedUser.username} (@
                  {selectedUser.username})
                </p>
              ) : (
                <>
                  {search.trim().length >= 2 &&
                    (search.trim() !== debouncedSearch || users.isFetching) && (
                      <p role="status">Searching…</p>
                    )}
                  {users.isError && (
                    <p role="alert" className="text-destructive">
                      Failed to search users. Try again.
                    </p>
                  )}
                  {search.trim() === debouncedSearch && users.isSuccess && (
                    <ul
                      aria-label="User search results"
                      className="max-h-60 overflow-auto"
                    >
                      {users.data.map((user) => (
                        <li key={user.id}>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              setSelectedUser(user)
                              setSearch(user.name || user.username)
                              form.setFieldValue('userId', user.id)
                            }}
                          >
                            {user.name || user.username} (@{user.username})
                          </Button>
                        </li>
                      ))}
                      {users.data.length === 0 && <li>No users found.</li>}
                    </ul>
                  )}
                </>
              )}
            </div>
            <form.Field
              name="role"
              children={(field) => (
                <div className="space-y-2">
                  <Label htmlFor="role-type">Role</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(value) => {
                      field.handleChange(value as Role)
                      form.setFieldValue('eventId', '')
                      grant.reset()
                    }}
                  >
                    <SelectTrigger id="role-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            />
            <form.Subscribe
              selector={(state) => state.values.role}
              children={(role) => (
                <form.Field
                  name="eventId"
                  children={(field) => (
                    <div className="space-y-2">
                      <Label htmlFor="role-event">Event (optional)</Label>
                      <Select
                        disabled={
                          (role !== 'ADMIN' && role !== 'MODERATOR') ||
                          !events.isSuccess
                        }
                        value={field.state.value || 'global'}
                        onValueChange={(value) =>
                          field.handleChange(value === 'global' ? '' : value)
                        }
                      >
                        <SelectTrigger id="role-event">
                          <SelectValue placeholder="Global role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="global">Global role</SelectItem>
                          {events.data?.map((event) => (
                            <SelectItem key={event.id} value={event.id}>
                              {event.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        Leave global to apply across all events. Only Admin and
                        Moderator support event scope.
                      </p>
                      {events.isError && (
                        <p role="alert" className="text-destructive">
                          Failed to load events.{' '}
                          <button
                            type="button"
                            className="underline"
                            onClick={() => void events.refetch()}
                          >
                            Retry
                          </button>
                        </p>
                      )}
                    </div>
                  )}
                />
              )}
            />
            {grant.isError && (
              <p role="alert" className="text-destructive">
                {roleErrorMessage(grant.error, 'grant')}
              </p>
            )}
            {grant.isSuccess && <p role="status">Role granted.</p>}
            <form.Subscribe
              selector={(state) => state.canSubmit}
              children={(canSubmit) => (
                <Button
                  type="submit"
                  disabled={!selectedUser || !canSubmit || grant.isPending}
                >
                  {grant.isPending ? 'Granting…' : 'Grant role'}
                </Button>
              )}
            />
          </form>
        </CardContent>
      </Card>
      {roles.isPending && <Spinner />}
      {roles.isError && (
        <p role="alert" className="text-destructive">
          Failed to load roles.{' '}
          <Button variant="outline" onClick={() => void roles.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {roles.data &&
        [false, true].map((scoped) => (
          <Card key={String(scoped)}>
            <CardHeader>
              <CardTitle>{scoped ? 'Event roles' : 'Global roles'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {roles.data.filter((row) => Boolean(row.eventId) === scoped)
                .length === 0 && (
                <p className="text-muted-foreground">No roles granted.</p>
              )}
              {roles.data
                .filter((row) => Boolean(row.eventId) === scoped)
                .map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center gap-4 border-b pb-4"
                  >
                    <Avatar>
                      <AvatarImage src={row.user.profilePicture} alt="" />
                      <AvatarFallback>
                        {(row.user.name || row.user.username)
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">
                        {row.user.name || row.user.username} (@
                        {row.user.username})
                      </p>
                      <p>
                        {ROLE_LABELS[row.role]}
                        {scoped && ` · ${row.event?.name || row.eventId}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Granted by {row.grantedBy?.username || 'Unknown'} ·{' '}
                        {new Date(row.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        remove.reset()
                        setRemoval(row)
                        setRemovalOpen(true)
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
            </CardContent>
          </Card>
        ))}
      <Dialog
        open={removalOpen}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setRemovalOpen(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove role?</DialogTitle>
            <DialogDescription>
              Remove {removal && ROLE_LABELS[removal.role]} from @
              {removal?.user.username}
              {removal?.eventId
                ? ` for ${removal.event?.name || removal.eventId}`
                : ' globally'}
              ?
            </DialogDescription>
          </DialogHeader>
          {remove.isError && (
            <p role="alert" className="text-destructive">
              {roleErrorMessage(remove.error, 'remove')}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={remove.isPending}
              onClick={() => setRemovalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (removal) remove.mutate(removal.id)
              }}
            >
              {remove.isPending ? 'Removing…' : 'Remove role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
