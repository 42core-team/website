import type { Event } from '@/app/actions/event'
import { LIFECYCLE_ORDER, eventState } from '@/lib/event-lifecycle'
import type { MomentEvent } from '@/lib/event-moment'

export interface EventTab {
  name: string
  path: string
  /** Set when the tab is muted for the current phase, e.g. "Opens 09:00". */
  hint?: string
}

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
  const opensHint = `Opens ${formatTime(event.startDate)}`
  const playHint =
    phase === 'REGISTRATION'
      ? opensHint
      : phase === 'PLAYING'
        ? undefined
        : 'Closed'

  const tabs: EventTab[] = [
    { name: 'Info', path: eventPath },
    { name: 'Teams', path: `${eventPath}/teams` },
  ]

  if (isRegistered) {
    tabs.push({ name: 'My Team', path: `${eventPath}/my-team` })
    if (supportsUnitBuilder)
      tabs.push({
        name: 'Unit Builder',
        path: `${eventPath}/unit-builder`,
        hint: phase === 'REGISTRATION' ? opensHint : undefined,
      })
    if (hasTeam) {
      tabs.push({
        name: 'Match Making',
        path: `${eventPath}/queue`,
        hint: playHint,
      })
      if (event.gamblingEnabled)
        tabs.push({
          name: 'Gambling',
          path: `${eventPath}/gambling`,
          hint: playHint,
        })
    }
  }

  if (
    isAdmin ||
    LIFECYCLE_ORDER.indexOf(phase) >=
      LIFECYCLE_ORDER.indexOf('SUBMISSIONS_CLOSED')
  )
    tabs.push(
      { name: 'Group Phase', path: `${eventPath}/groups` },
      { name: 'Tournament Tree', path: `${eventPath}/bracket` },
    )

  if (isAdmin) tabs.push({ name: 'Dashboard', path: `${eventPath}/dashboard` })

  return tabs
}
