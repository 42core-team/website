import type { Event } from '@/app/actions/event'
import type { Team } from '@/app/actions/team'

type LifecycleEvent = Pick<Event, 'state' | 'startDate' | 'submissionDeadline'>

export const LIFECYCLE_ORDER: Event['state'][] = [
  'REGISTRATION',
  'PLAYING',
  'SUBMISSIONS_CLOSED',
  'SHOWCASE',
  'COMPLETED',
]

/** Participant-facing phase names (see GLOSSARY.md); stored states keep their names. */
export const lifecycleLabels: Record<Event['state'], string> = {
  REGISTRATION: 'Registration',
  PLAYING: 'Coding',
  SUBMISSIONS_CLOSED: 'Code freeze',
  SHOWCASE: 'Showtime',
  COMPLETED: 'Completed',
}

export function eventState(
  event: LifecycleEvent,
  now = Date.now(),
): Event['state'] {
  if (['SUBMISSIONS_CLOSED', 'SHOWCASE', 'COMPLETED'].includes(event.state))
    return event.state
  if (now >= new Date(event.submissionDeadline).getTime())
    return 'SUBMISSIONS_CLOSED'
  if (now >= new Date(event.startDate).getTime()) return 'PLAYING'
  return 'REGISTRATION'
}

export function registrationOpen(event: LifecycleEvent, now = Date.now()) {
  return ['REGISTRATION', 'PLAYING'].includes(eventState(event, now))
}

export function matchmakingOpen(
  event: LifecycleEvent,
  team: Pick<Team, 'repositoryStatus' | 'tournamentExcluded'>,
  now = Date.now(),
) {
  return (
    eventState(event, now) === 'PLAYING' && team.repositoryStatus === 'READY'
  )
}

/** Tournament generation needs every nonexcluded repository confirmed locked. */
export function repositoryConfirmedForTournament(
  team: Pick<Team, 'repositoryStatus' | 'tournamentExcluded'>,
) {
  return team.tournamentExcluded || team.repositoryStatus === 'LOCKED'
}

export function bettingOpen(
  event: LifecycleEvent & Pick<Event, 'gamblingEnabled'>,
  now = Date.now(),
) {
  return event.gamblingEnabled && eventState(event, now) === 'PLAYING'
}

export function teamEditsOpen(
  event: LifecycleEvent,
  team: Pick<Team, 'locked' | 'repositoryStatus'>,
  now = Date.now(),
) {
  return (
    registrationOpen(event, now) &&
    !team.locked &&
    !['PROVISIONING', 'LOCKING', 'LOCKED', 'UNLOCKING'].includes(
      team.repositoryStatus ?? 'PENDING',
    )
  )
}
