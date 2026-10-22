import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Loader2, Swords } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { getTeamsForEventTable } from '@/app/actions/team'
import { createManualMatch, getManualMatches } from '@/app/actions/tournament'
import { MatchState } from '@/app/actions/tournament-model'
import MatchesList from '@/components/MatchesList'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'

const RUNNING_MATCHES_REFETCH_INTERVAL_MS = 5000

interface ManualMatchesManagementProps {
  eventId: string
}

export function ManualMatchesManagement({
  eventId,
}: ManualMatchesManagementProps) {
  const queryClient = useQueryClient()
  const [teamOneId, setTeamOneId] = useState('')
  const [teamTwoId, setTeamTwoId] = useState('')

  const teamsQuery = useQuery({
    queryKey: ['event', eventId, 'teams', 'admin'],
    queryFn: () =>
      getTeamsForEventTable(eventId, undefined, 'name', 'asc', true),
  })

  const manualMatchesQuery = useQuery({
    queryKey: ['event', eventId, 'manual-matches'],
    queryFn: () => getManualMatches(eventId),
    refetchInterval: (query) =>
      query.state.data?.some((match) => match.state !== MatchState.FINISHED)
        ? RUNNING_MATCHES_REFETCH_INTERVAL_MS
        : false,
  })

  const createMutation = useMutation({
    mutationFn: () => createManualMatch(eventId, teamOneId, teamTwoId),
    onSuccess: async () => {
      toast.success('Manual match started.')
      await queryClient.invalidateQueries({
        queryKey: ['event', eventId, 'manual-matches'],
      })
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const teams = teamsQuery.data ?? []
  const canStart =
    Boolean(teamOneId && teamTwoId) &&
    teamOneId !== teamTwoId &&
    !createMutation.isPending

  const renderTeamSelect = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    otherTeamId: string,
  ) => (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value}
        onValueChange={onChange}
        disabled={teamsQuery.isPending}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue
            placeholder={teamsQuery.isPending ? 'Loading teams…' : 'Pick team'}
          />
        </SelectTrigger>
        <SelectContent>
          {teams.map((team) => (
            <SelectItem
              key={team.id}
              value={team.id}
              disabled={team.id === otherTeamId}
            >
              {team.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Start Manual Match</CardTitle>
          <CardDescription>
            Run a game between two specific teams. The result does not affect
            scores, ratings, credits or rounds and is only listed below for
            admins.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-end">
            {renderTeamSelect(
              'manual-match-team-one',
              'Team one',
              teamOneId,
              setTeamOneId,
              teamTwoId,
            )}
            {renderTeamSelect(
              'manual-match-team-two',
              'Team two',
              teamTwoId,
              setTeamTwoId,
              teamOneId,
            )}
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!canStart}
            >
              {createMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Swords className="size-4" />
              )}
              Start match
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manual Matches</CardTitle>
          <CardDescription>
            The latest 100 admin-started matches for this event.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {manualMatchesQuery.isPending ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : manualMatchesQuery.isError ? (
            <p className="py-8 text-center text-destructive">
              Failed to load manual matches.
            </p>
          ) : (
            <MatchesList
              eventId={eventId}
              matches={manualMatchesQuery.data}
              isInsideCard
              emptyMessage="No manual matches yet"
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function getErrorMessage(error: unknown) {
  if (isAxiosError(error)) {
    const message = (
      error.response?.data as { message?: string | string[] } | undefined
    )?.message
    if (Array.isArray(message)) return message.join(', ')
    if (message) return message
  }
  return 'Failed to start manual match.'
}
