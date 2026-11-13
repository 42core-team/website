import { useQuery } from '@tanstack/react-query'
import { getEventAbilities } from '@/app/actions/event'
import type { EventAbilities } from '@/app/actions/event'
import { useSession } from '@/lib/auth'

export const NO_EVENT_ABILITIES: EventAbilities = {
  administer: false,
  viewUnrevealedResults: false,
  publish: false,
}

export function eventAbilitiesQueryKey(eventId: string, userId?: string) {
  return ['event', eventId, 'abilities', userId] as const
}

/**
 * The current user's abilities in one event, to decide which controls to
 * show. Guests have none. Until they are known, or if they cannot be loaded,
 * everything gated on them stays hidden.
 */
export function useEventAbilities(eventId: string) {
  const session = useSession()
  const userId = session.data?.user.id
  const query = useQuery({
    queryKey: eventAbilitiesQueryKey(eventId, userId),
    queryFn: () => getEventAbilities(eventId),
    enabled: Boolean(userId),
  })

  return {
    abilities:
      userId && !query.isError
        ? (query.data ?? NO_EVENT_ABILITIES)
        : NO_EVENT_ABILITIES,
    isPending: session.status === 'loading' || (!!userId && query.isPending),
  }
}
