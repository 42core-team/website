import { getMyEventTeam } from '@/app/actions/team'

export function myTeamQueryKey(eventId: string) {
  return ['event', eventId, 'my-team'] as const
}

export async function myTeamQueryFn(eventId: string) {
  return await getMyEventTeam(eventId)
}
