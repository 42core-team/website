import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  ROLE_LABELS,
  grantEventRole,
  grantRole,
  removeEventRole,
  removeRole,
  roleErrorMessage,
  searchAdminEvents,
} from '@/app/actions/roles'
import type {
  AdminEventSearchResult,
  Role,
  RoleGrant,
} from '@/app/actions/roles'
import type { UserSearchResult } from '@/app/actions/user'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RoleSearch } from './role-search'

export const EVENT_ROLES: Role[] = ['ADMIN', 'MODERATOR']
export const GLOBAL_ROLES: Role[] = [
  ...EVENT_ROLES,
  'PUBLIC_EVENT_CREATOR',
  'PRIVATE_EVENT_CREATOR',
]

type Step =
  | { kind: 'list' }
  | { kind: 'grant'; scope: 'global' | 'event' }
  | { kind: 'remove'; grant: RoleGrant }

export function RoleEditor({
  user,
  grants,
  event,
  onClose,
}: {
  user: UserSearchResult
  grants: RoleGrant[]
  event?: { id: string; name: string }
  onClose: () => void
}) {
  const [step, setStep] = useState<Step>({ kind: 'list' })
  const [role, setRole] = useState<Role | ''>('')
  const [selectedEvent, setSelectedEvent] =
    useState<AdminEventSearchResult | null>(null)
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: async () => {
      if (step.kind === 'remove') {
        if (event) return removeEventRole(event.id, step.grant.id)
        return removeRole(step.grant.id)
      }
      if (step.kind !== 'grant' || !role) return
      if (event) return grantEventRole(event.id, { userId: user.id, role })
      return grantRole({
        userId: user.id,
        role,
        eventId: step.scope === 'event' ? selectedEvent?.id : undefined,
      })
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin', 'roles'] }),
        client.invalidateQueries({ queryKey: ['auth', 'session'] }),
        client.invalidateQueries({
          queryKey: event ? ['event', event.id] : ['event'],
        }),
      ])
      setStep({ kind: 'list' })
    },
    onError: (error) => {
      const status = isAxiosError(error) ? error.response?.status : undefined
      if (status === 403) {
        void client.invalidateQueries({ queryKey: ['auth', 'session'] })
        if (event)
          void client.invalidateQueries({ queryKey: ['event', event.id] })
      }
      if (status === 404) {
        void client.invalidateQueries({ queryKey: ['admin'] })
        if (event)
          void client.invalidateQueries({ queryKey: ['event', event.id] })
      }
    },
  })
  const changeStep = (next: Step) => {
    mutation.reset()
    setStep(next)
    setRole('')
    setSelectedEvent(null)
  }

  function group(scope: 'global' | 'event') {
    const scoped = scope === 'event'
    const entries = grants.filter((grant) => Boolean(grant.eventId) === scoped)
    return (
      <section className="min-w-0 space-y-2 rounded-md border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">
            {scoped ? 'Event roles' : 'Global roles'}
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => changeStep({ kind: 'grant', scope })}
          >
            Add {scope} role
          </Button>
        </div>
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground">No roles assigned.</p>
        )}
        {entries.map((grant) => (
          <div
            key={grant.id}
            className="flex items-center justify-between gap-2 border-t pt-2 text-sm"
          >
            <div>
              {ROLE_LABELS[grant.role]}
              {scoped && !event && (
                <p className="text-xs text-muted-foreground">
                  {grant.event?.name}
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Remove ${ROLE_LABELS[grant.role]}${grant.event ? ` for ${grant.event.name}` : ' global role'}`}
              onClick={() => changeStep({ kind: 'remove', grant })}
            >
              Remove
            </Button>
          </div>
        ))}
      </section>
    )
  }

  const name = user.name || user.username
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose()
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {step.kind === 'list'
              ? `Edit roles for ${name}`
              : step.kind === 'grant'
                ? `Add ${step.scope} role`
                : 'Remove role?'}
          </DialogTitle>
          <DialogDescription>
            @{user.username}
            {event && ` · ${event.name}`}
          </DialogDescription>
        </DialogHeader>
        {step.kind === 'list' ? (
          <>
            <div className={event ? '' : 'grid gap-2 sm:grid-cols-2'}>
              {!event && group('global')}
              {group('event')}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(submit) => {
              submit.preventDefault()
              if (mutation.isPending) return
              if (
                step.kind === 'grant' &&
                (!role || (step.scope === 'event' && !event && !selectedEvent))
              )
                return
              mutation.mutate()
            }}
          >
            {step.kind === 'grant' ? (
              <>
                {step.scope === 'event' &&
                  !event &&
                  (selectedEvent ? (
                    <div className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                      <span>
                        {selectedEvent.name}
                        {selectedEvent.isPrivate && ' (private)'}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={mutation.isPending}
                        onClick={() => setSelectedEvent(null)}
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <RoleSearch
                      label="Event"
                      placeholder="Search events by name"
                      search={searchAdminEvents}
                      renderResult={(result) => (
                        <>
                          {result.name}{' '}
                          {result.isPrivate && (
                            <span className="text-muted-foreground">
                              Private
                            </span>
                          )}
                        </>
                      )}
                      onSelect={setSelectedEvent}
                    />
                  ))}
                <label className="grid gap-2 text-sm">
                  Role
                  <select
                    className="native-select"
                    value={role}
                    disabled={mutation.isPending}
                    onChange={(change) =>
                      setRole(change.target.value as Role | '')
                    }
                  >
                    <option value="">Choose role</option>
                    {(step.scope === 'event' ? EVENT_ROLES : GLOBAL_ROLES).map(
                      (value) => (
                        <option key={value} value={value}>
                          {ROLE_LABELS[value]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </>
            ) : (
              <p className="text-sm">
                Remove {name}’s {ROLE_LABELS[step.grant.role]} role{' '}
                {step.grant.eventId
                  ? `for ${event?.name ?? step.grant.event?.name ?? 'this event'}`
                  : 'globally'}
                ?
              </p>
            )}
            {mutation.isError && (
              <p role="alert" className="text-sm text-destructive">
                {roleErrorMessage(
                  mutation.error,
                  step.kind,
                  step.kind === 'remove' && Boolean(step.grant.eventId),
                )}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => changeStep({ kind: 'list' })}
              >
                Back
              </Button>
              <Button
                type="submit"
                variant={step.kind === 'remove' ? 'destructive' : 'default'}
                disabled={
                  mutation.isPending ||
                  (step.kind === 'grant' &&
                    (!role ||
                      (step.scope === 'event' && !event && !selectedEvent)))
                }
              >
                {step.kind === 'remove' ? 'Remove role' : 'Grant role'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
