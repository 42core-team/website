import type { Event } from '@/app/actions/event'
import type { Team } from '@/app/actions/team'
import {
  LIFECYCLE_ORDER,
  eventState,
  registrationOpen,
  teamEditsOpen,
} from '@/lib/event-lifecycle'
import type { MomentEvent } from '@/lib/event-moment'

export type EventTabGroup = 'info' | 'teams' | 'team' | 'tournament' | 'admin'

export interface EventTab {
  name: string
  path: string
  /** Tabs are rendered in groups, separated by dividers. */
  group: EventTabGroup
  /** Why the tab shows a lock, e.g. "Opens 09:00" or "Closed". */
  lockedReason?: string
  /** A locked tab stays clickable unless its page has nothing to show yet. */
  disabled?: boolean
}

type Lock = Pick<EventTab, 'lockedReason' | 'disabled'>

/**
 * Tabs in journey order: Info, Teams, your team's work, the tournament, then
 * admin. Only Dashboard is ever hidden; every other tab is shown and locked
 * when it does not apply yet or not to this viewer. The header shows the
 * event name as the label of the Info tab.
 */
export function eventTabs({
  event,
  now = Date.now(),
  isRegistered,
  team,
  isAdmin,
  supportsUnitBuilder,
  formatTime,
}: {
  event: MomentEvent & Pick<Event, 'gamblingEnabled'>
  now?: number
  isRegistered: boolean
  team: Pick<Team, 'locked' | 'repositoryStatus'> | null
  isAdmin: boolean
  supportsUnitBuilder: boolean
  formatTime: (iso: string) => string
}): EventTab[] {
  const phase = eventState(event, now)
  const eventPath = `/events/${event.id}`
  const opensReason = `Opens ${formatTime(event.startDate)}`
  const closed = { lockedReason: 'Closed' }
  const lockedOut = (lockedReason: string) => ({ lockedReason, disabled: true })
  // Viewers see every tool, locked; only participants can open team tools.
  const viewerLock = lockedOut(
    isRegistered ? 'Join a team first' : 'Join the event first',
  )
  // Before coding the tools are locked and closed; afterwards they stay
  // readable (history, results) but are marked as closed.
  const codingLock: Lock =
    phase === 'REGISTRATION'
      ? lockedOut(opensReason)
      : phase === 'PLAYING'
        ? {}
        : closed
  const tournamentOpen =
    LIFECYCLE_ORDER.indexOf(phase) >=
    LIFECYCLE_ORDER.indexOf('SUBMISSIONS_CLOSED')

  const myTeamLock: Lock = team
    ? teamEditsOpen(event, team, now)
      ? {}
      : { lockedReason: 'Read only' }
    : !isRegistered
      ? lockedOut('Join the event first')
      : registrationOpen(event, now)
        ? {}
        : // Without a team there is nothing to see once team creation has closed.
          lockedOut('Closed')

  const tabs: EventTab[] = [
    { name: 'Info', path: eventPath, group: 'info' },
    { name: 'Teams', path: `${eventPath}/teams`, group: 'teams' },
    {
      name: 'My Team',
      path: `${eventPath}/my-team`,
      group: 'team',
      ...myTeamLock,
    },
    {
      name: 'Unit Builder',
      path: `${eventPath}/unit-builder`,
      group: 'team',
      ...(!supportsUnitBuilder
        ? lockedOut('Not used in this event')
        : !isRegistered
          ? viewerLock
          : phase === 'REGISTRATION'
            ? lockedOut(opensReason)
            : {}),
    },
    {
      name: 'Match Making',
      path: `${eventPath}/queue`,
      group: 'team',
      ...(team ? codingLock : viewerLock),
    },
    {
      name: 'Gambling',
      path: `${eventPath}/gambling`,
      group: 'team',
      ...(!event.gamblingEnabled
        ? lockedOut('Not enabled')
        : team
          ? codingLock
          : viewerLock),
    },
    ...(['Group Phase', 'Tournament Tree'] as const).map((name): EventTab => ({
      name,
      path: `${eventPath}/${name === 'Group Phase' ? 'groups' : 'bracket'}`,
      group: 'tournament',
      // Admins prepare the tournament before it is public.
      ...(tournamentOpen || isAdmin
        ? {}
        : lockedOut(`Opens ${formatTime(event.submissionDeadline)}`)),
    })),
  ]

  if (isAdmin)
    tabs.push({
      name: 'Dashboard',
      path: `${eventPath}/dashboard`,
      group: 'admin',
    })

  return tabs
}
