import type { Event } from '@/app/actions/event'

const RECENT_EVENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export type EventStatus = 'upcoming' | 'live' | 'completed'

export interface EventsViewModel {
  featuredEvent?: Event
  events: Event[]
  joinedEventIds: Set<string>
}

export function getEventStatus(event: Event, now: number): EventStatus {
  const startDate = new Date(event.startDate).getTime()
  const endDate = new Date(event.endDate).getTime()

  if (now < startDate) {
    return 'upcoming'
  }

  if (now <= endDate) {
    return 'live'
  }

  return 'completed'
}

function compareByNewestStartDate(first: Event, second: Event) {
  const dateDifference =
    new Date(second.startDate).getTime() - new Date(first.startDate).getTime()

  return dateDifference || first.id.localeCompare(second.id)
}

function compareByNextStartDate(first: Event, second: Event) {
  const dateDifference =
    new Date(first.startDate).getTime() - new Date(second.startDate).getTime()

  return dateDifference || first.id.localeCompare(second.id)
}

function compareByMostRecentEndDate(first: Event, second: Event) {
  const dateDifference =
    new Date(second.endDate).getTime() - new Date(first.endDate).getTime()

  return dateDifference || compareByNewestStartDate(first, second)
}

function selectFeaturedEvent(events: Event[], now: number) {
  const activeEvents = events
    .filter((event) => getEventStatus(event, now) === 'live')
    .sort(compareByNewestStartDate)

  const upcomingEvents = events
    .filter((event) => getEventStatus(event, now) === 'upcoming')
    .sort(compareByNextStartDate)

  const recentlyCompletedEvents = events
    .filter((event) => {
      const endDate = new Date(event.endDate).getTime()

      return endDate < now && endDate >= now - RECENT_EVENT_WINDOW_MS
    })
    .sort(compareByMostRecentEndDate)

  return (
    activeEvents.at(0) ?? upcomingEvents.at(0) ?? recentlyCompletedEvents.at(0)
  )
}

export function buildPublicEventsViewModel(
  publicEvents: Event[],
  now: number,
): EventsViewModel {
  const featuredEvent = selectFeaturedEvent(publicEvents, now)
  const events = publicEvents
    .filter((event) => event.id !== featuredEvent?.id)
    .sort(compareByNewestStartDate)

  return { featuredEvent, events, joinedEventIds: new Set() }
}

export function buildEventsViewModel(
  publicEvents: Event[],
  joinedEvents: Event[],
  now: number,
): EventsViewModel {
  const joinedEventIds = new Set(joinedEvents.map((event) => event.id))
  const accessibleEvents = new Map(
    publicEvents.map((event) => [event.id, event]),
  )

  for (const event of joinedEvents) {
    accessibleEvents.set(event.id, event)
  }

  const featuredEvent =
    selectFeaturedEvent(joinedEvents, now) ??
    selectFeaturedEvent(publicEvents, now)
  const events = Array.from(accessibleEvents.values())
    .filter((event) => event.id !== featuredEvent?.id)
    .sort(compareByNewestStartDate)

  return { featuredEvent, events, joinedEventIds }
}
