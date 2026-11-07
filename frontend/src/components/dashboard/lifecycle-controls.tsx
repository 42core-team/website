import type { Event, TeamRepositoryActivity } from '@/app/actions/event'
import {
  excludeInactiveTeams,
  getRepositoryActivity,
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
import { CircleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  eventState,
  lifecycleLabels,
  repositoryConfirmedForTournament,
} from '@/lib/event-lifecycle'
import { useEventClock } from '@/hooks/use-event-clock'

function RepositoryActivityDialog({
  activity,
  canExclude,
  isPending,
  onClose,
  onConfirm,
}: {
  activity: TeamRepositoryActivity[]
  canExclude: boolean
  isPending: boolean
  onClose: () => void
  onConfirm: (teamIds: string[]) => void
}) {
  const inactive = activity.filter((team) => team.status === 'inactive')
  const unknown = activity.filter((team) => team.status === 'unknown')
  const [selected, setSelected] = useState(
    () => new Set(inactive.map((team) => team.teamId)),
  )
  const remaining = activity.length - selected.size
  const blockedReason =
    selected.size === 0
      ? 'Select at least one inactive team to exclude.'
      : remaining < 2
        ? `At least 2 teams must stay in the tournament. Deselect ${2 - remaining} more to continue.`
        : null
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Repository activity</DialogTitle>
          <DialogDescription>
            Inactive teams have no commits on their default branch besides the
            initial commit.{' '}
            {canExclude
              ? `${remaining} of ${activity.length} teams remain in the tournament if you exclude the selected ones.`
              : 'Teams can still push until the submission deadline, so this is only a preview. You can exclude teams during code freeze.'}
          </DialogDescription>
        </DialogHeader>
        {inactive.length === 0 && <p>No inactive repositories found.</p>}
        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {inactive.map((team) => {
            const id = `inactive-team-${team.teamId}`
            if (!canExclude) return <li key={team.teamId}>{team.teamName}</li>
            return (
              <li key={team.teamId} className="flex items-center gap-2">
                <Checkbox
                  id={id}
                  checked={selected.has(team.teamId)}
                  onCheckedChange={(checked) =>
                    setSelected((current) => {
                      const next = new Set(current)
                      if (checked === true) next.add(team.teamId)
                      else next.delete(team.teamId)
                      return next
                    })
                  }
                />
                <label htmlFor={id}>{team.teamName}</label>
              </li>
            )
          })}
        </ul>
        {unknown.length > 0 && (
          <Alert variant="destructive">
            <CircleAlert className="size-4" aria-hidden="true" />
            <AlertTitle>Couldn't check these repositories</AlertTitle>
            <AlertDescription>
              {unknown.map((team) => team.teamName).join(', ')}.
              {canExclude &&
                ' They stay in the tournament unless you exclude them individually.'}
            </AlertDescription>
          </Alert>
        )}
        {canExclude && inactive.length > 0 && blockedReason && (
          <p className="text-sm text-muted-foreground">{blockedReason}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {canExclude ? 'Cancel' : 'Close'}
          </Button>
          {canExclude && (
            <Button
              disabled={isPending || blockedReason !== null}
              onClick={() => onConfirm([...selected])}
            >
              Exclude selected teams
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

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
  const [activity, setActivity] = useState<TeamRepositoryActivity[] | null>(
    null,
  )
  const teams = useQuery({
    queryKey: ['event', event.id, 'repository-progress'],
    queryFn: () =>
      getTeamsForEventTable(event.id, undefined, 'name', 'asc', true),
    refetchInterval: 3000,
  })
  const showError = (error: Error) =>
    toast.error(
      isAxiosError<{ message?: string }>(error)
        ? (error.response?.data.message ?? error.message)
        : error.message,
    )
  const mutation = useMutation({
    mutationFn: async (operation: () => Promise<unknown>) => operation(),
    onSuccess: async () => {
      await client.invalidateQueries()
      toast.success('Lifecycle updated.')
    },
    onError: showError,
  })
  const activityCheck = useMutation({
    mutationFn: () => getRepositoryActivity(event.id),
    onSuccess: setActivity,
    onError: showError,
  })
  const exclusion = useMutation({
    mutationFn: (teamIds: string[]) => excludeInactiveTeams(event.id, teamIds),
    onSuccess: async ({ excludedTeamIds }, teamIds) => {
      // The server rechecks activity, so a team may no longer count as inactive.
      const skipped = (activity ?? [])
        .filter(
          ({ teamId }) =>
            teamIds.includes(teamId) && !excludedTeamIds.includes(teamId),
        )
        .map(({ teamName }) => teamName)
      setActivity(null)
      await client.invalidateQueries()
      if (skipped.length > 0)
        toast.warning(
          `Excluded ${excludedTeamIds.length} teams. Not excluded because they are no longer confirmed inactive: ${skipped.join(', ')}`,
        )
      else toast.success(`Excluded ${excludedTeamIds.length} teams.`)
    },
    onError: showError,
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
          Coding start and close are automatic. Scheduled end is informational.
          Showtime requires every repository locked or its team excluded.
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
              Start Showtime
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
            <Button
              variant="outline"
              disabled={
                !['PLAYING', 'SUBMISSIONS_CLOSED'].includes(state) ||
                activityCheck.isPending
              }
              onClick={() => activityCheck.mutate()}
            >
              Check repository activity
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
          <Alert variant="destructive">
            <CircleAlert className="size-4" aria-hidden="true" />
            <AlertTitle>Couldn't load repository progress</AlertTitle>
            <AlertDescription>
              The list refreshes automatically; reload the page if this stays.
            </AlertDescription>
          </Alert>
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
      {activity && (
        <RepositoryActivityDialog
          activity={activity}
          canExclude={state === 'SUBMISSIONS_CLOSED'}
          isPending={exclusion.isPending}
          onClose={() => setActivity(null)}
          onConfirm={(teamIds) => exclusion.mutate(teamIds)}
        />
      )}
    </Card>
  )
}
