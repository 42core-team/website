import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Loader2, Plus, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  addToWhitelist,
  bulkRemoveFromWhitelist,
  getEventWhitelist,
  removeFromWhitelist,
} from '@/app/actions/event'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { WhitelistPlatform } from '@/lib/constants/whitelist'

interface WhitelistManagementProps {
  eventId: string
}

export function WhitelistManagement({ eventId }: WhitelistManagementProps) {
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [usernames, setUsernames] = useState('')
  const [platform, setPlatform] = useState<WhitelistPlatform>(
    WhitelistPlatform.GITHUB,
  )
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const whitelistQuery = useQuery({
    queryKey: ['event', eventId, 'whitelist'],
    queryFn: () => getEventWhitelist(eventId),
  })

  const list = whitelistQuery.data ?? []

  const addMutation = useMutation({
    mutationFn: (
      entries: { username: string; platform: WhitelistPlatform }[],
    ) => addToWhitelist(eventId, entries),
    onSuccess: async () => {
      toast.success('Users added to whitelist')
      setAddOpen(false)
      await queryClient.invalidateQueries({
        queryKey: ['event', eventId, 'whitelist'],
      })
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'Failed to add users.')),
  })

  const removeMutation = useMutation({
    mutationFn: (whitelistId: string) =>
      removeFromWhitelist(eventId, whitelistId),
    onSuccess: async (_data, whitelistId) => {
      toast.success('User removed from whitelist')
      setSelectedIds((previous) => {
        const next = new Set(previous)
        next.delete(whitelistId)
        return next
      })
      await queryClient.invalidateQueries({
        queryKey: ['event', eventId, 'whitelist'],
      })
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'Failed to remove user.')),
  })

  const bulkRemoveMutation = useMutation({
    mutationFn: (ids: string[]) => bulkRemoveFromWhitelist(eventId, ids),
    onSuccess: async () => {
      toast.success('Users removed from whitelist')
      setSelectedIds(new Set())
      await queryClient.invalidateQueries({
        queryKey: ['event', eventId, 'whitelist'],
      })
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'Failed to remove users.')),
  })

  const handleAdd = () => {
    const lines = usernames
      .split('\n')
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line.length > 0)

    if (lines.length === 0) {
      toast.error('Please enter at least one username')
      return
    }

    addMutation.mutate(lines.map((username) => ({ username, platform })))
  }

  const handleDialogOpenChange = (open: boolean) => {
    setAddOpen(open)
    if (!open) {
      setUsernames('')
      setPlatform(WhitelistPlatform.GITHUB)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds(
      selectedIds.size === list.length
        ? new Set()
        : new Set(list.map((entry) => entry.id)),
    )
  }

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) {
      toast.error('Please select users to delete')
      return
    }
    bulkRemoveMutation.mutate(Array.from(selectedIds))
  }

  const selectAllState =
    list.length > 0 && selectedIds.size === list.length
      ? true
      : selectedIds.size > 0
        ? 'indeterminate'
        : false

  return (
    <Dialog open={addOpen} onOpenChange={handleDialogOpenChange}>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle>
              Whitelist
              {!whitelistQuery.isPending && !whitelistQuery.isError && (
                <span className="ml-1.5 font-normal text-muted-foreground">
                  ({list.length})
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Manage which users can join this private event. If the whitelist
              is empty, anyone with the link can join.
            </CardDescription>
          </div>
          {!whitelistQuery.isPending && !whitelistQuery.isError && (
            <div className="mt-0.5 flex shrink-0 items-center gap-2">
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  Add users
                </Button>
              </DialogTrigger>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {whitelistQuery.isPending ? (
            <WhitelistSkeleton />
          ) : whitelistQuery.isError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Failed to load whitelist</AlertTitle>
              <AlertDescription>
                Please refresh the page to try again.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size}{' '}
                    {selectedIds.size === 1 ? 'user' : 'users'} selected
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkRemoveMutation.isPending}
                  >
                    {bulkRemoveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Delete selected
                  </Button>
                </div>
              )}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectAllState}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all whitelisted users"
                        />
                      </TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
                            <Users className="h-8 w-8 opacity-40" />
                            <p className="text-sm">
                              No users whitelisted. Anyone with the link can
                              join.
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      list.map((entry) => (
                        <TableRow
                          key={entry.id}
                          data-state={
                            selectedIds.has(entry.id) ? 'selected' : undefined
                          }
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(entry.id)}
                              onCheckedChange={() => toggleSelect(entry.id)}
                              aria-label={`Select ${entry.username}`}
                            />
                          </TableCell>
                          <TableCell className="font-mono">
                            {entry.username}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                entry.platform === WhitelistPlatform.GITHUB
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {entry.platform === WhitelistPlatform.GITHUB
                                ? 'GitHub'
                                : '42'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => removeMutation.mutate(entry.id)}
                              disabled={removeMutation.isPending}
                              aria-label={`Remove ${entry.username} from whitelist`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add users to whitelist</DialogTitle>
          <DialogDescription>
            Enter one username per line. They will be added with the selected
            platform.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="usernames">Usernames</Label>
            <Textarea
              id="usernames"
              placeholder={`username1
username2
username3`}
              value={usernames}
              onChange={(event) => setUsernames(event.target.value)}
              rows={10}
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform">Platform</Label>
            <Select
              value={platform}
              onValueChange={(value: WhitelistPlatform) => setPlatform(value)}
            >
              <SelectTrigger id="platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={WhitelistPlatform.GITHUB}>GitHub</SelectItem>
                <SelectItem value={WhitelistPlatform.FORTYTWO}>
                  42 Intra
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={addMutation.isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleAdd}
            disabled={addMutation.isPending || !usernames.trim()}
          >
            {addMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Add to whitelist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function WhitelistSkeleton() {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Skeleton className="h-4 w-4" />
            </TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead className="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 3 }).map((_, index) => (
            <TableRow key={index}>
              <TableCell>
                <Skeleton className="h-4 w-4" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-36" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-14 rounded-full" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-8 w-8 rounded-md" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}
