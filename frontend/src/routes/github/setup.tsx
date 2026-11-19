import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { completeGithubAppInstallation } from '@/app/actions/event'
import Link from '@/components/app-link'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useSession } from '@/lib/auth'

/** GitHub's App "Setup URL": it sends the user here after an installation. */
export const Route = createFileRoute('/github/setup')({
  validateSearch: (search: Record<string, unknown>) => ({
    installationId: parseInstallationId(search.installation_id),
    setupAction:
      typeof search.setup_action === 'string' ? search.setup_action : '',
    state: typeof search.state === 'string' ? search.state : '',
  }),
  component: GithubSetupRoute,
})

function parseInstallationId(value: unknown) {
  const id = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function GithubSetupRoute() {
  const { installationId, setupAction, state } = Route.useSearch()
  const { status } = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canComplete =
    status === 'authenticated' && installationId !== null && Boolean(state)

  const completion = useQuery({
    queryKey: ['github', 'setup', installationId, state],
    queryFn: () => completeGithubAppInstallation(installationId!, state),
    enabled: canComplete,
    retry: false,
    staleTime: Infinity,
  })

  useEffect(() => {
    const eventId = completion.data?.eventId
    if (!eventId) return
    toast.success('GitHub connected.')
    void queryClient.invalidateQueries({ queryKey: ['event', eventId] })
    void navigate({
      to: '/events/$id/dashboard',
      params: { id: eventId },
      replace: true,
    })
  }, [completion.data, navigate, queryClient])

  let message: string | null = null
  if (setupAction === 'request')
    message =
      'GitHub sent the installation request to the owners of your organization. Once an owner approves it, they can connect the App from the event dashboard.'
  else if (installationId === null || !state)
    message =
      'GitHub did not return an installation for this event. Start again from the event dashboard.'
  else if (status === 'unauthenticated')
    message = 'Sign in, then connect GitHub again from the event dashboard.'
  else if (completion.isError) message = getErrorMessage(completion.error)

  return (
    <div className="container mx-auto flex max-w-xl justify-center py-16">
      <Card className="w-full space-y-4 p-6 text-center">
        <h1 className="text-xl font-semibold">Connecting GitHub</h1>
        {message ? (
          <>
            <p className="text-muted-foreground">{message}</p>
            <Link href="/events" className="underline">
              Back to events
            </Link>
          </>
        ) : (
          <Spinner className="mx-auto" />
        )}
      </Card>
    </div>
  )
}

function getErrorMessage(error: unknown) {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data.message
    if (Array.isArray(message)) return message.join(', ')
    if (message) return message
  }
  return 'Could not connect GitHub. Try again from the event dashboard.'
}
