import type { Event } from '@/app/actions/event'
import { LIFECYCLE_ORDER, eventState } from '@/lib/event-lifecycle'
import type { MomentEvent } from '@/lib/event-moment'

export type EventTabGroup = 'info' | 'teams' | 'team' | 'tournament' | 'admin'

export interface EventTab {
  name: string
  path: string
  /** Tabs are rendered in groups, separated by dividers. */
  group: EventTabGroup
  /** Why the tab is locked in the current phase, e.g. "Opens 09:00". */
  lockedReason?: string
}

/**
 * Tabs in journey order: Info, Teams, your team's work, the tournament, then
 * admin. The header shows the event name as the label of the Info tab.
 */
export function eventTabs({
  event,
  now = Date.now(),
  isRegistered,
  hasTeam,
  isAdmin,
  supportsUnitBuilder,
  formatTime,
}: {
  event: MomentEvent & Pick<Event, 'gamblingEnabled'>
  now?: number
  isRegistered: boolean
  hasTeam: boolean
  isAdmin: boolean
  supportsUnitBuilder: boolean
  formatTime: (iso: string) => string
}): EventTab[] {
  const phase = eventState(event, now)
  const eventPath = `/events/${event.id}`
  const opensReason = `Opens ${formatTime(event.startDate)}`
  const codingReason =
    phase === 'REGISTRATION'
      ? opensReason
      : phase === 'PLAYING'
        ? undefined
        : 'Closed'

  const tabs: EventTab[] = [
    { name: 'Info', path: eventPath, group: 'info' },
    { name: 'Teams', path: `${eventPath}/teams`, group: 'teams' },
  ]

  if (isRegistered) {
    tabs.push({ name: 'My Team', path: `${eventPath}/my-team`, group: 'team' })
    if (supportsUnitBuilder)
      tabs.push({
        name: 'Unit Builder',
        path: `${eventPath}/unit-builder`,
        group: 'team',
        lockedReason: phase === 'REGISTRATION' ? opensReason : undefined,
      })
    if (hasTeam)
      tabs.push({
        name: 'Match Making',
        path: `${eventPath}/queue`,
        group: 'team',
        lockedReason: codingReason,
      })
    if (hasTeam && event.gamblingEnabled)
      tabs.push({
        name: 'Gambling',
        path: `${eventPath}/gambling`,
        group: 'team',
        lockedReason: codingReason,
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
