import type { Team, TeamMember } from '@/app/actions/team'
import {
  eventState,
  registrationOpen,
  teamEditsOpen,
} from '@/lib/event-lifecycle'
import { useEventClock } from '@/hooks/use-event-clock'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { useState } from 'react'
import axiosInstance from '@/app/actions/axios'
import { getEventById, getEventGithubOrg } from '@/app/actions/event'
import {
  acceptTeamInvite,
  declineTeamInvite,
  getTeamMembers,
  getUserPendingInvites,
  leaveTeam,
} from '@/app/actions/team'
import { getMatchesForTeam } from '@/app/actions/tournament'
import { myTeamQueryFn, myTeamQueryKey } from '@/app/events/my-team-queries'
import {
  LocationTags,
  TeamCreationSection,
  TeamInfoSection,
  TeamMatchHistory,
} from '@/components/team'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { validateTeamName } from '@/lib/utils/validation'

const REPO_CREATION_POLL_INTERVAL_MS = 2000

/**
 * The viewer's own team: details, repository, members and match history, or
 * team creation and invites when they have no team yet. Shown under My Team
 * and when the viewer opens their own team from the Teams list.
 */
export function MyTeamPage({
  eventId: id,
  showBack = false,
  onLeft,
}: Readonly<{
  eventId: string
  /** Show the profile's back button, e.g. when opened from the Teams list. */
  showBack?: boolean
  /** Called after leaving the team, before the team data is refreshed. */
  onLeft?: () => void
}>) {
  const now = useEventClock()
  const queryClient = useQueryClient()
  const [newTeamName, setNewTeamName] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const eventQuery = useQuery({
    queryKey: ['event', id],
    queryFn: async () => getEventById(id),
    refetchInterval: 1000,
  })
  const myTeamQuery = useQuery<Team | null>({
    queryKey: myTeamQueryKey(id),
    queryFn: () => myTeamQueryFn(id),
    refetchInterval: REPO_CREATION_POLL_INTERVAL_MS,
  })
  const teamMembersQuery = useQuery<TeamMember[]>({
    queryKey: ['team', myTeamQuery.data?.id, 'members'],
    queryFn: () => getTeamMembers(myTeamQuery.data!.id),
    enabled: Boolean(myTeamQuery.data?.id),
  })
  const pendingInvitesQuery = useQuery({
    queryKey: ['event', id, 'pending-invites'],
    queryFn: () => getUserPendingInvites(id),
    enabled: !myTeamQuery.data,
  })
  const githubOrgQuery = useQuery({
    queryKey: ['event', id, 'github-org'],
    queryFn: async () => getEventGithubOrg(id),
    enabled: Boolean(myTeamQuery.data),
    refetchInterval: ({ state }) =>
      myTeamQuery.data && !myTeamQuery.data.repo && !state.data
        ? REPO_CREATION_POLL_INTERVAL_MS
        : false,
  })
  const matchesQuery = useQuery({
    queryKey: ['team', myTeamQuery.data?.id, 'matches'],
    queryFn: () => getMatchesForTeam(myTeamQuery.data!.id),
    enabled: Boolean(myTeamQuery.data?.id),
  })

  const validation = validateTeamName(newTeamName)
  const createTeamMutation = useMutation({
    mutationFn: async (starterTemplateId?: string) => {
      if (!validation.isValid) {
        throw new Error(validation.error)
      }
      await axiosInstance.post(`team/event/${id}/create`, {
        name: newTeamName,
        starterTemplateId,
      })
    },
    onMutate: () => setErrorMessage(null),
    onSuccess: async () => {
      setNewTeamName('')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: myTeamQueryKey(id) }),
        queryClient.invalidateQueries({ queryKey: ['events'] }),
        queryClient.invalidateQueries({
          queryKey: ['event', id, 'pending-invites'],
        }),
      ])
    },
    onError: (error: Error | AxiosError<{ message?: string }>) => {
      if ('response' in error && error.response?.status === 400) {
        setErrorMessage(
          error.response.data.message ??
            'A team with this name already exists. Please choose a different name.',
        )
        return
      }

      if (error.message && !error.message.startsWith('An unexpected')) {
        setErrorMessage(error.message)
        return
      }

      setErrorMessage('An unexpected error occurred while creating the team.')
    },
  })

  const leaveTeamMutation = useMutation({
    mutationFn: async () => leaveTeam(id),
    onSuccess: async () => {
      onLeft?.()
      await queryClient.invalidateQueries({ queryKey: myTeamQueryKey(id) })
    },
  })

  const acceptInviteMutation = useMutation({
    mutationFn: async (teamId: string) => acceptTeamInvite(id, teamId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: myTeamQueryKey(id) }),
        queryClient.invalidateQueries({
          queryKey: ['event', id, 'pending-invites'],
        }),
      ])
    },
  })

  const declineInviteMutation = useMutation({
    mutationFn: async (teamId: string) => declineTeamInvite(id, teamId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['event', id, 'pending-invites'],
      })
    },
  })

  if (eventQuery.isPending || myTeamQuery.isPending) {
    return (
      <main className="flex min-h-[45vh] items-center justify-center">
        <Spinner />
      </main>
    )
  }

  if (eventQuery.isError) {
    return (
      <main className="container mx-auto max-w-5xl px-4 py-8">
        <Alert variant="destructive">
          <AlertTitle>Event unavailable</AlertTitle>
          <AlertDescription>Could not load event details.</AlertDescription>
        </Alert>
      </main>
    )
  }

  return (
    <main className="container mx-auto max-w-5xl px-4 py-8">
      {myTeamQuery.data ? (
        <div className="space-y-6">
          <TeamInfoSection
            myTeam={myTeamQuery.data}
            canEdit={teamEditsOpen(eventQuery.data, myTeamQuery.data, now)}
            onLeaveTeam={async () => {
              await leaveTeamMutation.mutateAsync()
              return true
            }}
            isLeaving={leaveTeamMutation.isPending}
            showBack={showBack}
            teamMembers={teamMembersQuery.data ?? []}
            githubOrg={githubOrgQuery.data ?? ''}
            isRepoPending={eventState(eventQuery.data, now) === 'REGISTRATION'}
            isRepoCreating={Boolean(
              myTeamQuery.data.repositoryStatus === 'PROVISIONING',
            )}
          />
          <TeamMatchHistory
            teamId={myTeamQuery.data.id}
            eventId={id}
            matches={matchesQuery.data ?? []}
            isLoading={matchesQuery.isPending}
            isError={matchesQuery.isError}
          />
        </div>
      ) : eventQuery.data.canCreateTeam &&
        registrationOpen(eventQuery.data, now) ? (
        <div className="space-y-6">
          <TeamCreationSection
            eventId={id}
            newTeamName={newTeamName}
            setNewTeamName={setNewTeamName}
            handleCreateTeam={async (starterTemplateId) => {
              await createTeamMutation.mutateAsync(starterTemplateId)
            }}
            isLoading={createTeamMutation.isPending}
            errorMessage={errorMessage}
            validationError={
              newTeamName && !validation.isValid ? validation.error : null
            }
          />
          <PendingInvites
            invites={pendingInvitesQuery.data ?? []}
            onAccept={(teamId) => acceptInviteMutation.mutate(teamId)}
            onDecline={(teamId) => declineInviteMutation.mutate(teamId)}
          />
        </div>
      ) : (
        <Alert>
          <AlertTitle>Team creation closed</AlertTitle>
          <AlertDescription>
            Team creation for this event is currently disabled.
          </AlertDescription>
        </Alert>
      )}
    </main>
  )
}

function PendingInvites({
  invites,
  onAccept,
  onDecline,
}: {
  invites: Team[]
  onAccept: (teamId: string) => void
  onDecline: (teamId: string) => void
}) {
  if (invites.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Invites</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{invite.name}</span>
              <LocationTags tags={invite.tags} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onAccept(invite.id)}>
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDecline(invite.id)}
              >
                Decline
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
