import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { MoreHorizontal, TriangleAlert } from 'lucide-react'
import {
  setDefaultPreset,
  duplicatePreset,
  archivePreset,
  unarchivePreset,
  presetError,
  invalidatePresets,
} from '@/app/actions/presets'
import { adminPresetsQuery } from '@/components/presets/queries'
import type { AdminPresetSummary } from '@/app/actions/presets'
import { AdminGuard } from '@/components/presets/admin-guard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'

export const Route = createFileRoute('/admin/presets/')({
  component: () => (
    <AdminGuard>
      <PresetsPage />
    </AdminGuard>
  ),
})

type Operation = 'duplicate' | 'archive' | 'unarchive' | 'default'

function updated(row: AdminPresetSummary) {
  const date = new Date(row.updatedAt)
  return Number.isNaN(date.getTime())
    ? '—'
    : formatDistanceToNow(date, { addSuffix: true })
}

export function PresetsPage() {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const rows = useQuery(adminPresetsQuery)
  const active = rows.data?.filter((row) => !row.archivedAt) ?? []
  const archived = rows.data?.filter((row) => row.archivedAt) ?? []
  const shown = tab === 'active' ? active : archived
  const action = useMutation({
    mutationFn: async ({
      id,
      operation,
    }: {
      id: string
      operation: Operation
    }) => {
      if (operation === 'duplicate') return duplicatePreset(id)
      if (operation === 'archive') return archivePreset(id)
      if (operation === 'unarchive') return unarchivePreset(id)
      return setDefaultPreset(id)
    },
    onSuccess: () => invalidatePresets(client),
  })
  const edit = (id: string) =>
    void navigate({ to: '/admin/presets/$id', params: { id } })
  return (
    <main className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Event presets</h1>
        <Button asChild>
          <Link to="/admin/presets/new">New preset</Link>
        </Button>
      </div>
      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="archived">
            Archived ({archived.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="space-y-4">
          {rows.isPending && <Spinner />}
          {rows.isError && (
            <p role="alert">
              Could not load presets.{' '}
              <Button onClick={() => void rows.refetch()}>Retry</Button>
            </p>
          )}
          {rows.data && shown.length === 0 && (
            <p className="text-muted-foreground">
              {tab === 'active' ? 'No active presets.' : 'No archived presets.'}
            </p>
          )}
          {shown.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Preset</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Warnings</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      // Menu items are portaled but still bubble here.
                      if (
                        !(e.target as Element).closest(
                          'a, button, [role=menuitem]',
                        )
                      )
                        edit(row.id)
                    }}
                  >
                    <TableCell className="max-w-md">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/admin/presets/$id"
                          params={{ id: row.id }}
                          className="font-medium hover:underline"
                        >
                          {row.name}
                        </Link>
                        {row.isDefault && (
                          <Badge variant="secondary">Default</Badge>
                        )}
                      </div>
                      {row.description && (
                        <p className="truncate text-muted-foreground">
                          {row.description}
                        </p>
                      )}
                      {action.isError && action.variables.id === row.id && (
                        <p role="alert" className="text-destructive">
                          {presetError(action.error)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      v{row.version}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.eventCount}
                    </TableCell>
                    <TableCell
                      className="whitespace-nowrap text-muted-foreground"
                      title={new Date(row.updatedAt).toLocaleString()}
                    >
                      {updated(row)}
                      {row.updatedBy && ` · @${row.updatedBy.username}`}
                    </TableCell>
                    <TableCell>
                      {row.warnings.length > 0 && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-amber-500/50 text-amber-700 dark:text-amber-400"
                          title={row.warnings.join(' ')}
                        >
                          <TriangleAlert
                            className="size-3"
                            aria-hidden="true"
                          />
                          {row.warnings.length}
                          <span className="sr-only">
                            {row.warnings.length === 1
                              ? ' warning'
                              : ' warnings'}
                            : {row.warnings.join(' ')}
                          </span>
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${row.name}`}
                            disabled={action.isPending}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => edit(row.id)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              action.mutate({
                                id: row.id,
                                operation: 'duplicate',
                              })
                            }
                          >
                            Duplicate
                          </DropdownMenuItem>
                          {!row.isDefault && !row.archivedAt && (
                            <DropdownMenuItem
                              onSelect={() =>
                                action.mutate({
                                  id: row.id,
                                  operation: 'default',
                                })
                              }
                            >
                              Set default
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() =>
                              action.mutate({
                                id: row.id,
                                operation: row.archivedAt
                                  ? 'unarchive'
                                  : 'archive',
                              })
                            }
                          >
                            {row.archivedAt ? 'Unarchive' : 'Archive'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </main>
  )
}
