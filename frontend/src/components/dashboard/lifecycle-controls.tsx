import type { Event } from '@/app/actions/event'
import {
  retryRepository,
  setTeamExclusion,
  transitionEvent,
} from '@/app/actions/event'
import { getTeamsForEventTable } from '@/app/actions/team'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  eventState,
  lifecycleLabels,
  repositoryConfirmedForTournament,
} from '@/lib/event-lifecycle'
import { useEventClock } from '@/hooks/use-event-clock'

export function LifecycleControls({
  event,
  children,
}: {
  event: Event
  children?: ReactNode
}) {
  const now = useEventClock()
  const client = useQueryClient()
  const [deadline, setDeadline] = useState('')
  const teams = useQuery({
    queryKey: ['event', event.id, 'repository-progress'],
    queryFn: () =>
      getTeamsForEventTable(event.id, undefined, 'name', 'asc', true),
    refetchInterval: 3000,
  })
  const mutation = useMutation({
    mutationFn: async (operation: () => Promise<unknown>) => operation(),
    onSuccess: async () => {
      await client.invalidateQueries()
      toast.success('Lifecycle updated.')
    },
    onError: (error: Error) =>
      toast.error(
        isAxiosError<{ message?: string }>(error)
          ? (error.response?.data.message ?? error.message)
          : error.message,
      ),
  })
  const state = eventState(event, now)
  const closed = ['SUBMISSIONS_CLOSED', 'SHOWCASE', 'COMPLETED'].includes(state)
  const confirmed =
    teams.data?.filter(repositoryConfirmedForTournament).length ?? 0
  const locksConfirmed = teams.isSuccess && confirmed === teams.data.length
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lifecycle: {lifecycleLabels[state]}</CardTitle>
        <CardDescription>
          Play and submission closure are automatic. Scheduled end is
          informational. Showcase requires every repository locked or its team
          excluded.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <p>
            {confirmed} / {teams.data?.length ?? '…'} repositories locked or
            teams excluded
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={
                state !== 'SUBMISSIONS_CLOSED' ||
                !locksConfirmed ||
                mutation.isPending
              }
              onClick={() =>
                mutation.mutate(() =>
                  transitionEvent(event.id, { action: 'showcase' }),
                )
              }
            >
              Start showcase
            </Button>
            <Button
              disabled={state !== 'SHOWCASE' || mutation.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    'Complete this event? Unrevealed matches can remain unrevealed. Results and bets are preserved.',
                  )
                )
                  mutation.mutate(() =>
                    transitionEvent(event.id, { action: 'complete' }),
                  )
              }}
            >
              Complete event
            </Button>
          </div>
          {closed && (
            <div className="space-y-2">
              <label htmlFor="reopen-deadline">
                New submission deadline (local time)
              </label>
              <Input
                id="reopen-deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
              <Button
                disabled={
                  mutation.isPending || !(new Date(deadline).getTime() > now)
                }
                onClick={() => {
                  if (
                    new Date(deadline).getTime() > Date.now() &&
                    window.confirm(
                      'Reopen play with this deadline? Tournament, bets and results are preserved. Match making resumes per team once repository writes are restored.',
                    )
                  )
                    mutation.mutate(() =>
                      transitionEvent(event.id, {
                        action: 'reopen',
                        submissionDeadline: new Date(deadline).getTime(),
                      }),
                    )
                }}
              >
                Reopen play
              </Button>
            </div>
          )}
        </div>
        {children}
        {teams.isError && (
          <p role="alert">Could not load repository progress.</p>
        )}
        <ul className="space-y-3">
          {teams.data?.map((team) => (
            <li
              key={team.id}
              className="flex flex-wrap items-center gap-3 border-t pt-3"
            >
              <span className="font-medium">{team.name}</span>
              <span>{team.repositoryStatus ?? 'PENDING'}</span>
              {team.tournamentExcluded && <span>Excluded from tournament</span>}
              {team.repositoryError && (
                <p className="w-full text-sm text-destructive">
                  {team.repositoryError}
                </p>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={
                  mutation.isPending || team.repositoryStatus !== 'FAILED'
                }
                onClick={() =>
                  mutation.mutate(() => retryRepository(event.id, team.id))
                }
              >
                Retry repository
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={mutation.isPending || state !== 'SUBMISSIONS_CLOSED'}
                onClick={() =>
                  mutation.mutate(() =>
                    setTeamExclusion(
                      event.id,
                      team.id,
                      !team.tournamentExcluded,
                    ),
                  )
                }
              >
                {team.tournamentExcluded ? 'Include team' : 'Exclude team'}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
