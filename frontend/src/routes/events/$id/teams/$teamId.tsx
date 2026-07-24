import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { AxiosError } from 'axios'
import { Swords } from 'lucide-react'
import { toast } from 'sonner'
import {
  getTeamById,
  getTeamMembers,
  startDirectMatch,
} from '@/app/actions/team'
import { getMatchesForTeam } from '@/app/actions/tournament'
import { myTeamQueryFn, myTeamQueryKey } from '@/app/events/my-team-queries'
import { TeamMatchHistory, TeamPublicProfile } from '@/components/team'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export const Route = createFileRoute('/events/$id/teams/$teamId')({
  component: TeamRoute,
})

function TeamRoute() {
  const { id, teamId } = Route.useParams()
  const queryClient = useQueryClient()
  const teamQuery = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => getTeamById(teamId),
  })
  const membersQuery = useQuery({
    queryKey: ['team', teamId, 'members'],
    queryFn: () => getTeamMembers(teamId),
  })
  const matchesQuery = useQuery({
    queryKey: ['team', teamId, 'matches'],
    queryFn: () => getMatchesForTeam(teamId),
  })
  const myTeamQuery = useQuery({
    queryKey: myTeamQueryKey(id),
    queryFn: () => myTeamQueryFn(id),
  })
  const attackMutation = useMutation({
    mutationFn: () => startDirectMatch(id, teamId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['event', id, 'queue-summary'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['event', id, 'queue-matches'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['team', teamId, 'matches'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['team', myTeamQuery.data?.id, 'matches'],
        }),
      ])
      toast.success('Attack started. You paid 1 credit and staked 1 credit.')
    },
    onError: (error: Error) => toast.error(getErrorMessage(error)),
  })

  if (teamQuery.isPending) {
    return (
      <main className="flex min-h-[45vh] items-center justify-center">
        <Spinner />
      </main>
    )
  }

  if (teamQuery.isError || !teamQuery.data) {
    return (
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <p className="text-center text-destructive">Team not found.</p>
      </main>
    )
  }

  const canAttack =
    Boolean(myTeamQuery.data) && myTeamQuery.data?.id !== teamQuery.data.id

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <TeamPublicProfile
        team={teamQuery.data}
        members={membersQuery.data ?? []}
        action={
          canAttack ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="w-full sm:w-auto"
                    disabled={attackMutation.isPending}
                    onClick={() => attackMutation.mutate()}
                  >
                    {attackMutation.isPending ? <Spinner /> : <Swords />}
                    {attackMutation.isPending
                      ? 'Starting attack'
                      : 'Attack this team · 2 credits'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="end"
                  className="max-w-xs text-pretty"
                >
                  A direct match requires 2 credits: 1 is always paid and 1 is
                  staked. Win to get the staked credit back; lose and both
                  credits are spent.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : undefined
        }
      />
      <div className="mt-6">
        <TeamMatchHistory
          eventId={id}
          matches={matchesQuery.data ?? []}
          isLoading={matchesQuery.isPending}
          isError={matchesQuery.isError}
        />
      </div>
    </main>
  )
}

function getErrorMessage(error: Error) {
  const axiosError = error as AxiosError<{ message?: string }>
  return axiosError.response?.data.message ?? error.message
}
