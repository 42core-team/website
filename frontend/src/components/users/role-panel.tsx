import { useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { ROLE_LABELS, searchAdminEvents } from '@/app/actions/roles'
import type { Role, RoleGrant } from '@/app/actions/roles'
import type { UserSearchResult } from '@/app/actions/user'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { userAvatarSrc } from '@/lib/user-avatar'
import { cn } from '@/lib/utils'
import { RoleSearch } from './role-search'

const EVENT_ROLES: Role[] = ['ADMIN', 'MODERATOR']
const GLOBAL_ROLES: Role[] = [
  ...EVENT_ROLES,
  'PUBLIC_EVENT_CREATOR',
  'PRIVATE_EVENT_CREATOR',
]
const DESCRIPTIONS: Record<Role, string> = {
  ADMIN: 'Full platform access',
  MODERATOR: 'Moderate every event',
  PUBLIC_EVENT_CREATOR: 'Create public events',
  PRIVATE_EVENT_CREATOR: 'Create private events',
}

/** One API call; `eventId` null grants globally. */
export type RoleOp =
  | { kind: 'grant'; role: Role; eventId: string | null }
  | { kind: 'remove'; grant: RoleGrant }
export interface RoleChange {
  user: UserSearchResult
  ops: RoleOp[]
  summary: string
  undo?: boolean
}

type Level = 'NONE' | 'MODERATOR' | 'ADMIN'
const LEVELS: { value: Level; label: string }[] = [
  { value: 'NONE', label: 'None' },
  { value: 'MODERATOR', label: 'Moderator' },
  { value: 'ADMIN', label: 'Admin' },
]

/** Admin wins when an event grants both roles. */
export function eventLevel(grants: RoleGrant[]): Level {
  if (grants.some((grant) => grant.role === 'ADMIN')) return 'ADMIN'
  if (grants.some((grant) => grant.role === 'MODERATOR')) return 'MODERATOR'
  return 'NONE'
}

function initials(user: UserSearchResult) {
  return (user.name || user.username)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

export function UserAvatar({
  user,
  className,
}: {
  user: UserSearchResult
  className?: string
}) {
  return (
    <Avatar aria-hidden className={cn('size-8 text-xs', className)}>
      <AvatarImage src={userAvatarSrc(user)} alt="" />
      <AvatarFallback>{initials(user)}</AvatarFallback>
    </Avatar>
  )
}

export function RolePanel({
  user,
  grants,
  event,
  pending,
  error,
  onChange,
}: {
  user: UserSearchResult
  grants: RoleGrant[]
  event?: { id: string; name: string }
  pending: boolean
  error: string | null
  onChange: (ops: RoleOp[], summary: string) => void
}) {
  // Events whose row stays visible after its roles are removed or before any are granted
  const [extraEvents, setExtraEvents] = useState(new Map<string, string>())
  const [adding, setAdding] = useState(false)
  const name = user.name || user.username
  const global = grants.filter((grant) => !grant.eventId)
  const events = new Map(event ? [[event.id, event.name]] : extraEvents)
  if (!event)
    for (const grant of grants)
      if (grant.eventId)
        events.set(grant.eventId, grant.event?.name ?? 'Unknown event')
  const keep = (id: string, eventName: string) =>
    setExtraEvents((current) => new Map(current).set(id, eventName))

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <UserAvatar user={user} className="size-12 text-base" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold">{name}</h2>
          <p className="text-sm text-muted-foreground">@{user.username}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/users/$username" params={{ username: user.username }}>
            View profile
          </Link>
        </Button>
      </header>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!event && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Global roles</h3>
          {GLOBAL_ROLES.map((role) => (
            <GlobalSwitch
              key={role}
              role={role}
              checked={global.some((grant) => grant.role === role)}
              disabled={pending}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [{ kind: 'grant', role, eventId: null }]
                    : global
                        .filter((grant) => grant.role === role)
                        .map((grant) => ({ kind: 'remove', grant })),
                  checked
                    ? `Granted ${ROLE_LABELS[role]} to ${name}`
                    : `Removed ${ROLE_LABELS[role]} from ${name}`,
                )
              }
            />
          ))}
        </section>
      )}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Event roles</h3>
          {!event && !adding && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus aria-hidden className="size-4" />
              Add to event
            </Button>
          )}
        </div>
        {!events.size && !adding && (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            {event
              ? 'No role in this event.'
              : 'Not staff at any event. Add them to an event to make them a moderator or admin.'}
          </p>
        )}
        {events.size > 0 && (
          <ul className="divide-y rounded-md border">
            {[...events]
              .sort((a, b) => a[1].localeCompare(b[1]))
              .map(([id, eventName]) => {
                const scoped = grants.filter((grant) => grant.eventId === id)
                const level = eventLevel(scoped)
                const since = scoped.find((grant) => grant.role === level)
                return (
                  <li
                    key={id}
                    className="flex flex-wrap items-center justify-between gap-2 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {eventName}
                      </p>
                      {since && (
                        <p className="text-xs text-muted-foreground">
                          Since {new Date(since.createdAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Segmented
                      label={`Role in ${eventName}`}
                      value={level}
                      disabled={pending}
                      onChange={(target) => {
                        if (target === level) return
                        const ops: RoleOp[] = []
                        if (target !== 'NONE')
                          ops.push({ kind: 'grant', role: target, eventId: id })
                        for (const grant of scoped)
                          if (grant.role !== target)
                            ops.push({ kind: 'remove', grant })
                        if (target === 'NONE') keep(id, eventName)
                        onChange(
                          ops,
                          target === 'NONE'
                            ? `Removed ${name}’s roles in ${eventName}`
                            : `${name} is now ${ROLE_LABELS[target]} of ${eventName}`,
                        )
                      }}
                    />
                  </li>
                )
              })}
          </ul>
        )}
        {adding && (
          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Add to an event</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAdding(false)}
              >
                Cancel
              </Button>
            </div>
            <RoleSearch
              label="Add to event…"
              hideLabel
              autoFocus
              minLength={1}
              placeholder="Search events by name"
              search={searchAdminEvents}
              renderResult={(result) => (
                <span className="flex w-full min-w-0 items-center gap-2">
                  <span className="truncate">{result.name}</span>
                  {result.isPrivate && <Badge variant="outline">Private</Badge>}
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {new Date(result.startDate).toLocaleDateString()}
                  </span>
                </span>
              )}
              onSelect={(result) => {
                keep(result.id, result.name)
                setAdding(false)
              }}
            />
            <p className="text-xs text-muted-foreground">
              Then pick Moderator or Admin in the new row.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

function GlobalSwitch({
  role,
  checked,
  disabled,
  onCheckedChange,
}: {
  role: Role
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label htmlFor={id}>{ROLE_LABELS[role]}</Label>
        <p id={`${id}-description`} className="text-xs text-muted-foreground">
          {DESCRIPTIONS[role]}
        </p>
      </div>
      <Switch
        id={id}
        aria-describedby={`${id}-description`}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  )
}

/** Radio group of buttons; arrows move focus, Enter/Space saves. */
function Segmented({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: Level
  disabled: boolean
  onChange: (value: Level) => void
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  function onKeyDown(event: KeyboardEvent, index: number) {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[
      event.key
    ]
    if (!step) return
    event.preventDefault()
    buttons.current[(index + step + LEVELS.length) % LEVELS.length]?.focus()
  }
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-md border bg-muted p-0.5"
    >
      {LEVELS.map((level, index) => {
        const checked = level.value === value
        return (
          <button
            key={level.value}
            ref={(button) => {
              buttons.current[index] = button
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onKeyDown={(event) => onKeyDown(event, index)}
            onClick={() => onChange(level.value)}
            className={cn(
              'rounded px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50',
              checked
                ? 'bg-background font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {level.label}
          </button>
        )
      })}
    </div>
  )
}
