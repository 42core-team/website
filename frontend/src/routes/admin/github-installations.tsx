import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  getAdminInstallations,
  shareInstallation,
  unshareInstallation,
  presetError,
} from '@/app/actions/presets'
import type { AdminInstallation } from '@/app/actions/presets'
import { AdminGuard } from '@/components/presets/admin-guard'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export const Route = createFileRoute('/admin/github-installations')({
  component: () => (
    <AdminGuard>
      <InstallationsPage />
    </AdminGuard>
  ),
})
export function InstallationsPage() {
  const client = useQueryClient()
  const [selection, setSelection] = useState<AdminInstallation | null>(null)
  const rows = useQuery({
    queryKey: ['admin', 'github-installations'],
    queryFn: getAdminInstallations,
  })
  const mutation = useMutation({
    mutationFn: async (row: AdminInstallation) =>
      row.sharedAt ? unshareInstallation(row.id) : shareInstallation(row.id),
    onSuccess: async () => {
      setSelection(null)
      await client.invalidateQueries({
        queryKey: ['admin', 'github-installations'],
      })
      await client.invalidateQueries({ queryKey: ['create-installations'] })
    },
  })
  return (
    <main className="container mx-auto space-y-6 px-4 py-8">
      <h1 className="text-3xl font-bold">GitHub installations</h1>
      {rows.isPending && <Spinner />}
      {rows.isError && (
        <p role="alert">
          Could not load installations.{' '}
          <Button onClick={() => void rows.refetch()}>Retry</Button>
        </p>
      )}
      {rows.data?.length === 0 && <p>No installations known to the app.</p>}
      {rows.data?.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap items-center gap-4 rounded border p-4"
        >
          <div className="flex-1">
            <strong>{row.accountLogin}</strong> · {row.accountType}
            <p>
              {row.eventCount} events ·{' '}
              {row.sharedAt
                ? `Shared by ${row.sharedBy?.username ?? 'Unknown'}`
                : 'Not shared'}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              mutation.reset()
              setSelection(row)
            }}
          >
            {row.sharedAt ? 'Unshare' : 'Share'}
          </Button>
        </div>
      ))}
      <Dialog
        open={Boolean(selection)}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setSelection(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selection?.sharedAt ? 'Unshare' : 'Share'}{' '}
              {selection?.accountLogin}?
            </DialogTitle>
            <DialogDescription>
              {selection?.sharedAt
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
              onClick={() => setSelection(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={mutation.isPending}
              onClick={() => selection && mutation.mutate(selection)}
            >
              {selection?.sharedAt ? 'Confirm unshare' : 'Confirm share'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
