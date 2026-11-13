import type { EventGithubStatus } from '@/app/actions/event'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { AlertCircle, GitBranch, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  getEventGithubStatus,
  getGithubAppInstallUrl,
  getLinkableGithubInstallations,
  linkGithubInstallation,
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

export function githubStatusQueryKey(eventId: string) {
  return ['event', eventId, 'github'] as const
}

export function useEventGithubStatus(eventId: string) {
  return useQuery({
    queryKey: githubStatusQueryKey(eventId),
    queryFn: () => getEventGithubStatus(eventId),
  })
}

/** Whether repositories can be created; true while the status is unknown. */
export function isGithubReady(status: EventGithubStatus | undefined) {
  if (!status) return true
  return status.installation?.status === 'active'
}

const STATUS_LABELS = {
  active: 'Connected',
  suspended: 'Suspended',
  uninstalled: 'Uninstalled',
} as const

export function GithubConnection({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient()
  const statusQuery = useEventGithubStatus(eventId)
  const appAvailable = statusQuery.data?.appAvailable ?? false
  // Installations made for other events, so the App need not be installed again.
  const linkableQuery = useQuery({
    queryKey: [...githubStatusQueryKey(eventId), 'installations'],
    queryFn: () => getLinkableGithubInstallations(eventId),
    enabled: appAvailable,
    staleTime: 60 * 1000,
  })
  const connectMutation = useMutation({
    mutationFn: () => getGithubAppInstallUrl(eventId),
    onSuccess: (url) => {
      window.location.assign(url)
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
  const linkMutation = useMutation({
    mutationFn: (installationId: number) =>
      linkGithubInstallation(eventId, installationId),
    onSuccess: () => {
      toast.success('GitHub connected.')
      void queryClient.invalidateQueries({ queryKey: ['event', eventId] })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'link')),
  })

  if (statusQuery.isError)
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load the GitHub connection</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-2">
          Repositories may not be created until GitHub is connected.
          <Button
            size="sm"
            variant="outline"
            onClick={() => void statusQuery.refetch()}
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    )
  const status = statusQuery.data
  if (!status) return null
  const installation = status.installation
  if (!status.appAvailable && !installation) return null
  const linkable = linkableQuery.data ?? []
  const busy = connectMutation.isPending || linkMutation.isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="size-5" aria-hidden="true" />
          GitHub Connection
          {installation && (
            <Badge
              variant={
                installation.status === 'active' ? 'secondary' : 'destructive'
              }
            >
              {STATUS_LABELS[installation.status]}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{describe(status)}</CardDescription>
      </CardHeader>
      {status.appAvailable && (
        <CardContent className="space-y-4">
          {linkableQuery.isError && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
              Could not check for existing installations of the App.
              <Button
                size="sm"
                variant="outline"
                onClick={() => void linkableQuery.refetch()}
              >
                Try again
              </Button>
            </p>
          )}
          {linkable.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                The App is already installed on{' '}
                {linkable.length === 1 ? 'an organization' : 'organizations'}{' '}
                you own. Use it for this event without installing it again:
              </p>
              <div className="flex flex-wrap gap-2">
                {linkable.map((candidate) => (
                  <Button
                    key={candidate.installationId}
                    variant={isGithubReady(status) ? 'outline' : 'default'}
                    disabled={busy}
                    onClick={() =>
                      linkMutation.mutate(candidate.installationId)
                    }
                  >
                    {linkMutation.isPending &&
                      linkMutation.variables === candidate.installationId && (
                        <Loader2 className="size-4 animate-spin" />
                      )}
                    Use {candidate.accountLogin}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <Button
            variant={
              isGithubReady(status) || linkable.length > 0
                ? 'outline'
                : 'default'
            }
            disabled={busy}
            onClick={() => connectMutation.mutate()}
          >
            {connectMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {installation
              ? 'Reconnect GitHub App'
              : linkable.length > 0
                ? 'Install on another organization'
                : 'Connect GitHub App'}
          </Button>
        </CardContent>
      )}
    </Card>
  )
}

function describe(status: EventGithubStatus) {
  const installation = status.installation
  if (installation?.status === 'active')
    return `Team repositories are created in ${installation.accountLogin} through the CORE GitHub App.`
  if (installation?.status === 'suspended')
    return `The CORE GitHub App is suspended on ${installation.accountLogin}. An organization owner must unsuspend it on GitHub before repositories can be created.`
  if (installation?.status === 'uninstalled')
    return `The CORE GitHub App was uninstalled from ${installation.accountLogin}. Reconnect it to create repositories and run matches.`
  // Events that used an organization token before keep their organization.
  if (status.githubOrg)
    return `GitHub is not connected. The team repositories are in ${status.githubOrg}, so an owner of ${status.githubOrg} must connect the CORE GitHub App there before repositories can be created and matches can run.`
  return 'GitHub is not connected yet. An owner of the organization that should hold the team repositories must connect the CORE GitHub App before teams can get repositories.'
}

function getErrorMessage(
  error: unknown,
  action: 'connect' | 'link' = 'connect',
) {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data.message
    if (Array.isArray(message)) return message.join(', ')
    if (message) return message
  }
  return action === 'link'
    ? 'Could not connect the installation.'
    : 'Could not start the GitHub connection.'
}
