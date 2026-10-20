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

/**
 * Tabs in journey order: Info, Teams, your team's work, the tournament, then
 * admin. The header shows the event name as the label of the Info tab.
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
  // Before coding the tools are locked and closed; afterwards they stay
  // readable (history, results) but are marked as closed.
  const codingLock: Pick<EventTab, 'lockedReason' | 'disabled'> =
    phase === 'REGISTRATION'
      ? { lockedReason: opensReason, disabled: true }
      : phase === 'PLAYING'
        ? {}
        : { lockedReason: 'Closed' }

  const tabs: EventTab[] = [
    { name: 'Info', path: eventPath, group: 'info' },
    { name: 'Teams', path: `${eventPath}/teams`, group: 'teams' },
  ]

  if (isRegistered) {
    tabs.push({
      name: 'My Team',
      path: `${eventPath}/my-team`,
      group: 'team',
      ...(team
        ? teamEditsOpen(event, team, now)
          ? {}
          : { lockedReason: 'Read only' }
        : registrationOpen(event, now)
          ? {}
          : // Without a team there is nothing to see once team creation has closed.
            { lockedReason: 'Closed', disabled: true }),
    })
    if (supportsUnitBuilder)
      tabs.push({
        name: 'Unit Builder',
        path: `${eventPath}/unit-builder`,
        group: 'team',
        ...(phase === 'REGISTRATION'
          ? { lockedReason: opensReason, disabled: true }
          : {}),
      })
    if (team)
      tabs.push({
        name: 'Match Making',
        path: `${eventPath}/queue`,
        group: 'team',
        ...codingLock,
      })
    if (team && event.gamblingEnabled)
      tabs.push({
        name: 'Gambling',
        path: `${eventPath}/gambling`,
        group: 'team',
        ...codingLock,
      })
  }

  if (
    isAdmin ||
    LIFECYCLE_ORDER.indexOf(phase) >=
      LIFECYCLE_ORDER.indexOf('SUBMISSIONS_CLOSED')
  )
    tabs.push(
      { name: 'Group Phase', path: `${eventPath}/groups`, group: 'tournament' },
      {
        name: 'Tournament Tree',
        path: `${eventPath}/bracket`,
        group: 'tournament',
      },
    )

  if (isAdmin)
    tabs.push({
      name: 'Dashboard',
      path: `${eventPath}/dashboard`,
      group: 'admin',
    })

  return tabs
}
