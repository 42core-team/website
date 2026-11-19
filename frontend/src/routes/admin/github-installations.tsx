import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Check, ExternalLink, Plus, X } from 'lucide-react'
import { isGithubAppAvailable } from '@/app/actions/event'
import {
  getAdminInstallUrl,
  getAdminInstallation,
  getAdminInstallations,
  shareInstallation,
  unshareInstallation,
  presetError,
} from '@/app/actions/presets'
import type { AdminInstallation } from '@/app/actions/presets'
import { AdminGuard } from '@/components/presets/admin-guard'
import {
  EntityAvatar,
  FilterChips,
  ListEmpty,
  ListRow,
  RowText,
  listDetailGrid,
} from '@/components/admin/list-detail'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { lifecycleLabels } from '@/lib/event-lifecycle'
import { cn } from '@/lib/utils'

const FILTERS = ['all', 'shared', 'private', 'inactive'] as const
type Filter = (typeof FILTERS)[number]
type InstallationsSearch = { filter?: Filter; installation?: string }

// The filter and the selected installation live in the URL, so Back and
// shared links keep them.
export const Route = createFileRoute('/admin/github-installations')({
  validateSearch: (search: Record<string, unknown>): InstallationsSearch => ({
    filter: FILTERS.find((filter) => filter === search.filter),
    installation:
      typeof search.installation === 'string' ? search.installation : undefined,
  }),
  component: InstallationsRoute,
})

function InstallationsRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <AdminGuard>
      <InstallationsPage
        filter={search.filter ?? 'all'}
        selectedId={search.installation ?? null}
        onChange={(next) =>
          void navigate({
            search: (current) => ({ ...current, ...next }),
            replace: true,
          })
        }
      />
    </AdminGuard>
  )
}
const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  shared: 'Shared',
  private: 'Not shared',
  inactive: 'Inactive',
}
const DOTS: Partial<Record<Filter, string>> = {
  shared: 'bg-success',
  private: 'bg-info',
  inactive: 'bg-warning',
}
const STATUS_LABELS: Record<AdminInstallation['status'], string> = {
  active: 'Active',
  suspended: 'Suspended',
  uninstalled: 'Uninstalled',
}

function matches(row: AdminInstallation, filter: Filter) {
  const active = row.status === 'active'
  if (filter === 'shared') return active && Boolean(row.sharedAt)
  if (filter === 'private') return active && !row.sharedAt
  if (filter === 'inactive') return !active
  return true
}

/** Where GitHub lets the account's owners configure the installation. */
function githubSettingsUrl(row: AdminInstallation) {
  return row.accountType === 'Organization'
    ? `https://github.com/organizations/${encodeURIComponent(row.accountLogin)}/settings/installations/${row.installationId}`
    : `https://github.com/settings/installations/${row.installationId}`
}

function AccountAvatar({
  row,
  className,
}: {
  row: AdminInstallation
  className?: string
}) {
  return (
    <EntityAvatar
      src={`https://github.com/${encodeURIComponent(row.accountLogin)}.png?size=80`}
      fallback={row.accountLogin.slice(0, 2).toUpperCase()}
      square
      className={className}
    />
  )
}

function summary(row: AdminInstallation) {
  if (row.status !== 'active') return STATUS_LABELS[row.status]
  const events = `${row.eventCount} ${row.eventCount === 1 ? 'event' : 'events'}`
  return `${row.sharedAt ? 'Shared' : 'Not shared'} · ${events}`
}

export function InstallationsPage({
  filter,
  selectedId,
  onChange,
}: {
  filter: Filter
  selectedId: string | null
  onChange: (next: InstallationsSearch) => void
}) {
  const client = useQueryClient()
  const [confirming, setConfirming] = useState<AdminInstallation | null>(null)
  // Kept after closing, so the dialog's text holds while it animates out.
  const [shown, setShown] = useState<AdminInstallation | null>(null)
  const rows = useQuery({
    queryKey: ['admin', 'github-installations'],
    queryFn: getAdminInstallations,
  })
  const available = useQuery({
    queryKey: ['github', 'app'],
    queryFn: isGithubAppAvailable,
  })
  const install = useMutation({
    mutationFn: getAdminInstallUrl,
    onSuccess: (url) => window.location.assign(url),
  })
  const mutation = useMutation({
    mutationFn: async (row: AdminInstallation) =>
      row.sharedAt ? unshareInstallation(row.id) : shareInstallation(row.id),
    onSuccess: async () => {
      setConfirming(null)
      await client.invalidateQueries({
        queryKey: ['admin', 'github-installations'],
      })
      await client.invalidateQueries({ queryKey: ['create-installations'] })
    },
  })
  const filtered = (rows.data ?? []).filter((row) => matches(row, filter))
  const selected = rows.data?.find((row) => row.id === selectedId) ?? null

  return (
    <main className="container mx-auto space-y-4 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">GitHub installations</h1>
          <p className="text-sm text-muted-foreground">
            Organizations where the CORE GitHub App is installed. Share one so
            event creators can use it.
          </p>
        </div>
        <Button
          disabled={!available.data || install.isPending || install.isSuccess}
          onClick={() => install.mutate()}
        >
          <Plus aria-hidden className="size-4" />
          Install on an organization
        </Button>
      </div>
      {available.data === false && (
        <p className="text-sm text-muted-foreground">
          The CORE GitHub App is not configured on this server.
        </p>
      )}
      {install.isError && <p role="alert">{presetError(install.error)}</p>}
      <FilterChips
        label="Filter installations"
        options={FILTERS}
        value={filter}
        onChange={(value) => onChange({ filter: value })}
        labels={FILTER_LABELS}
        dots={DOTS}
        count={(value) =>
          (rows.data ?? []).filter((row) => matches(row, value)).length
        }
      />
      {rows.isPending && <Spinner />}
      {rows.isError && (
        <p role="alert">
          Could not load installations.{' '}
          <Button onClick={() => void rows.refetch()}>Retry</Button>
        </p>
      )}
      {rows.data && (
        <div className={cn(listDetailGrid, 'items-start')}>
          <ul
            aria-label="Installations"
            className="max-h-[60dvh] divide-y overflow-y-auto rounded-md border lg:max-h-[calc(100dvh-16rem)]"
          >
            {filtered.map((row) => (
              <ListRow
                key={row.id}
                selected={row.id === selectedId}
                onSelect={() => onChange({ installation: row.id })}
              >
                <AccountAvatar row={row} />
                <RowText
                  title={row.accountLogin}
                  detail={summary(row)}
                  detailClassName={cn(
                    row.status !== 'active' && 'text-warning',
                  )}
                />
              </ListRow>
            ))}
            {!filtered.length && (
              <ListEmpty>
                {rows.data.length
                  ? 'No installations match this filter.'
                  : 'The App is not installed anywhere yet.'}
              </ListEmpty>
            )}
          </ul>
          <div className="rounded-md border p-4">
            {selected ? (
              <InstallationPanel
                row={selected}
                appAvailable={available.data !== false}
                pending={mutation.isPending}
                onToggleShare={() => {
                  mutation.reset()
                  setConfirming(selected)
                  setShown(selected)
                }}
              />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Select an installation to see its details.
              </p>
            )}
          </div>
        </div>
      )}
      <Dialog
        open={Boolean(confirming)}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setConfirming(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {shown?.sharedAt ? 'Unshare' : 'Share'} {shown?.accountLogin}?
            </DialogTitle>
            <DialogDescription>
              {shown?.sharedAt
                ? 'Event creators will no longer be able to use this as a shared installation. Existing events stay linked.'
                : 'Sharing lets any event creator use this GitHub installation for their events. You must own the GitHub account to share it.'}
            </DialogDescription>
          </DialogHeader>
          {mutation.isError && (
            <p role="alert">{presetError(mutation.error)}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setConfirming(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={mutation.isPending}
              onClick={() => confirming && mutation.mutate(confirming)}
            >
              {shown?.sharedAt ? 'Confirm unshare' : 'Confirm share'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function InstallationPanel({
  row,
  appAvailable,
  pending,
  onToggleShare,
}: {
  row: AdminInstallation
  appAvailable: boolean
  pending: boolean
  onToggleShare: () => void
}) {
  const detail = useQuery({
    queryKey: ['admin', 'github-installations', row.id],
    queryFn: () => getAdminInstallation(row.id),
    // Each fetch asks GitHub for the permissions.
    staleTime: 60_000,
  })
  const switchId = useId()
  const active = row.status === 'active'
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AccountAvatar row={row} className="size-12 text-sm" />
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold">
              {row.accountLogin}
            </h2>
            <p className="text-sm text-muted-foreground">
              {row.accountType === 'Organization' ? 'Organization' : 'User'} ·
              installation #{row.installationId}
              {!active && (
                <span className="text-warning">
                  {' '}
                  · {STATUS_LABELS[row.status]}
                </span>
              )}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={githubSettingsUrl(row)} target="_blank" rel="noreferrer">
            Open on GitHub
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        </Button>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Sharing</h3>
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor={switchId}>Shared with event creators</Label>
            <p
              id={`${switchId}-hint`}
              className="text-sm text-muted-foreground"
            >
              {row.sharedAt
                ? `Any event creator can use it for their events. Shared by @${row.sharedBy?.username ?? 'unknown'} on ${new Date(row.sharedAt).toLocaleDateString()}.`
                : 'Only owners of this account can use it for their events.'}
            </p>
          </div>
          <Switch
            id={switchId}
            aria-describedby={`${switchId}-hint`}
            checked={Boolean(row.sharedAt)}
            disabled={pending || (!active && !row.sharedAt)}
            onCheckedChange={onToggleShare}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Permissions</h3>
        {!active ? (
          <p className="text-sm text-muted-foreground">
            Not checked while the App is{' '}
            {STATUS_LABELS[row.status].toLowerCase()}.
          </p>
        ) : !appAvailable ? (
          <p className="text-sm text-muted-foreground">
            Not checked: the CORE GitHub App is not configured on this server.
          </p>
        ) : detail.isPending ? (
          <Spinner />
        ) : detail.data?.permissions ? (
          <ul className="space-y-1 text-sm">
            {detail.data.permissions.map((permission) => (
              <li
                key={permission.name}
                className="flex items-center justify-between"
              >
                <span className="capitalize">
                  {permission.name} ({permission.access})
                </span>
                {permission.granted ? (
                  <span className="flex items-center gap-1 text-success">
                    <Check aria-hidden className="size-4" /> Granted
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-destructive">
                    <X aria-hidden className="size-4" /> Missing
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Could not check the permissions on GitHub.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">
          Used by {row.eventCount} {row.eventCount === 1 ? 'event' : 'events'}
        </h3>
        {detail.isPending ? (
          <Spinner />
        ) : detail.isError ? (
          <p role="alert" className="text-sm">
            Could not load the events.{' '}
            <Button variant="link" onClick={() => void detail.refetch()}>
              Retry
            </Button>
          </p>
        ) : detail.data.events.length ? (
          <ul className="divide-y rounded-md border">
            {detail.data.events.map((event) => (
              <li key={event.id}>
                <Link
                  to="/events/$id"
                  params={{ id: event.id }}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <span className="truncate font-medium">{event.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {lifecycleLabels[event.state]} ·{' '}
                    {new Date(event.startDate).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            No events use this installation.
          </p>
        )}
      </section>
    </div>
  )
}
