import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { isActionError } from '@/app/actions/errors'
import {
  getEventById,
  getStarterTemplates,
  updateEventSettings,
} from '@/app/actions/event'
import { lockEvent, unlockEvent } from '@/app/actions/team'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'

export const Route = createFileRoute('/events/$id/dashboard')({
  component: DashboardRoute,
})

function DashboardRoute() {
  const { id } = Route.useParams()
  const queryClient = useQueryClient()
  const eventQuery = useQuery({
    queryKey: ['event', id],
    queryFn: async () => {
      const event = await getEventById(id)
      if (isActionError(event)) throw new Error(event.error)
      return event
    },
  })
  const templatesQuery = useQuery({
    queryKey: ['event', id, 'templates'],
    queryFn: async () => {
      const templates = await getStarterTemplates(id)
      if (isActionError(templates)) throw new Error(templates.error)
      return templates
    },
  })
  const updateMutation = useMutation({
    mutationFn: async (settings: {
      name?: string
      location?: string
      canCreateTeam?: boolean
      processQueue?: boolean
      isPrivate?: boolean
    }) => {
      const result = await updateEventSettings(id, settings)
      if (isActionError(result)) throw new Error(result.error)
      return result
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['event', id] })
    },
  })
  const lockMutation = useMutation({
    mutationFn: () => lockEvent(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['event', id] })
    },
  })
  const unlockMutation = useMutation({
    mutationFn: () => unlockEvent(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['event', id] })
    },
  })

  if (eventQuery.isPending) {
    return (
      <main className="flex min-h-[45vh] items-center justify-center">
        <Spinner />
      </main>
    )
  }

  if (eventQuery.isError) {
    return (
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <p className="text-center text-destructive">
          Failed to load dashboard.
        </p>
      </main>
    )
  }

  const event = eventQuery.data

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Event Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="event-name">Name</Label>
              <Input
                id="event-name"
                defaultValue={event.name}
                onBlur={(e) => {
                  if (e.currentTarget.value !== event.name) {
                    updateMutation.mutate({ name: e.currentTarget.value })
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-location">Location</Label>
              <Input
                id="event-location"
                defaultValue={event.location ?? ''}
                onBlur={(e) => {
                  if (e.currentTarget.value !== (event.location ?? '')) {
                    updateMutation.mutate({ location: e.currentTarget.value })
                  }
                }}
              />
            </div>
            <SettingSwitch
              label="Team creation"
              checked={event.canCreateTeam}
              onCheckedChange={(checked) =>
                updateMutation.mutate({ canCreateTeam: checked })
              }
            />
            <SettingSwitch
              label="Process queue"
              checked={event.processQueue}
              onCheckedChange={(checked) =>
                updateMutation.mutate({ processQueue: checked })
              }
            />
            <SettingSwitch
              label="Private event"
              checked={event.isPrivate}
              onCheckedChange={(checked) =>
                updateMutation.mutate({ isPrivate: checked })
              }
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-4">
              <div>
                <p className="font-medium">Teams Lock</p>
                <p className="text-sm text-muted-foreground">
                  {event.lockedAt
                    ? 'Teams are locked.'
                    : 'Teams are currently editable.'}
                </p>
              </div>
              {event.lockedAt ? (
                <Button
                  variant="outline"
                  disabled={unlockMutation.isPending}
                  onClick={() => unlockMutation.mutate()}
                >
                  Unlock
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  disabled={lockMutation.isPending}
                  onClick={() => lockMutation.mutate()}
                >
                  Lock
                </Button>
              )}
            </div>
            <div className="rounded-md border p-4">
              <p className="mb-3 font-medium">Starter Templates</p>
              <div className="space-y-2">
                {(templatesQuery.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No starter templates configured.
                  </p>
                ) : (
                  templatesQuery.data?.map((template) => (
                    <div
                      key={template.id}
                      className="rounded-md bg-muted px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{template.name}</span>
                      <span className="ml-2 text-muted-foreground">
                        {template.basePath}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function SettingSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
