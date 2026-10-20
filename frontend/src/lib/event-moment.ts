import type { Event } from '@/app/actions/event'
import type { Team } from '@/app/actions/team'
import { eventState } from '@/lib/event-lifecycle'

type Phase = Event['state']

export const DEADLINE_WARNING_MS = 3 * 60 * 60 * 1000
/** The last stretch before repositories lock, shown in red. */
export const DEADLINE_DANGER_MS = 15 * 60 * 1000

export type MomentEvent = Pick<
  Event,
  | 'id'
  | 'state'
  | 'startDate'
  | 'submissionDeadline'
  | 'isPrivate'
  | 'introEnabled'
  | 'introLeadMinutes'
  | 'streamUrl'
  | 'showtimeStreamUrl'
>

export interface MomentViewer {
  isRegistered: boolean
  team: Pick<Team, 'repositoryStatus'> | null
}

export type MomentTone = 'neutral' | 'active' | 'warning' | 'danger'

/** Pages are reached through the event tabs, so links only point off-site (streams). */
export type MomentAction =
  | { kind: 'join'; label: string }
  | { kind: 'link'; label: string; href: string }

export interface EventMoment {
  phase: Phase
  tone: MomentTone
  /** Small label above the headline, e.g. "Get ready". */
  kicker: string
  headline: string
  description: string
  /** ISO timestamp to count down to, if any. */
  countdownTo: string | null
  /** What the countdown means; differs from the headline when an alert replaces it. */
  countdownLabel: string | null
  actions: MomentAction[]
}

export function introTime(event: MomentEvent): Date | null {
  if (!event.introEnabled) return null
  return new Date(
    new Date(event.startDate).getTime() - event.introLeadMinutes * 60_000,
  )
}

export function momentRemainingMs(moment: EventMoment, now: number) {
  return moment.countdownTo
    ? new Date(moment.countdownTo).getTime() - now
    : null
}

interface MomentOptions {
  now?: number
}

/**
 * The single source for what the event status UI says right now:
 * headline, countdown, tone and call to action for this viewer.
 * A `null` viewer is still loading: no calls to action yet.
 */
export function eventMoment(
  event: MomentEvent,
  viewer: MomentViewer | null,
  options: MomentOptions = {},
): EventMoment {
  if (viewer) return momentFor(event, viewer, options)
  return {
    ...momentFor(event, { isRegistered: false, team: null }, options),
    actions: [],
  }
}

function momentFor(
  event: MomentEvent,
  viewer: MomentViewer,
  { now = Date.now() }: MomentOptions,
): EventMoment {
  const phase = eventState(event, now)
  const showtimeStream = event.showtimeStreamUrl ?? event.streamUrl

  if (phase === 'REGISTRATION' || phase === 'PLAYING') {
    const coding = phase === 'PLAYING'
    const deadlineMs = new Date(event.submissionDeadline).getTime() - now
    const closingSoon = coding && deadlineMs <= DEADLINE_WARNING_MS
    const lastMinutes = coding && deadlineMs <= DEADLINE_DANGER_MS
    const base: EventMoment = {
      phase,
      tone: lastMinutes ? 'danger' : closingSoon ? 'warning' : 'active',
      kicker: !coding
        ? 'Get ready'
        : lastMinutes
          ? 'Final minutes'
          : closingSoon
            ? 'Final hours'
            : 'Coding',
      headline: coding ? 'Coding ends in' : 'Coding starts in',
      description: coding
        ? 'Push to your repository and queue for matches. Repositories lock at the deadline.'
        : 'Form your team now. Repositories are created when coding starts.',
      countdownTo: coding ? event.submissionDeadline : event.startDate,
      countdownLabel: coding ? 'Coding ends in' : 'Coding starts in',
      actions: [],
    }

    const intro = introTime(event)
    if (
      !coding &&
      intro &&
      event.streamUrl &&
      now >= intro.getTime() - 3_600_000
    ) {
      base.actions.push({
        kind: 'link',
        label: 'Watch intro',
        href: event.streamUrl,
      })
    }

    if (event.isPrivate && !viewer.isRegistered) {
      return {
        ...base,
        description:
          'This is a private event. Join it first, then create a team or accept an invite.',
        actions: [{ kind: 'join', label: 'Join event' }, ...base.actions],
      }
    }

    if (viewer.isRegistered && !viewer.team) {
      return {
        ...base,
        description: 'Get started: create a team or join one with an invite.',
      }
    }

    if (viewer.team?.repositoryStatus === 'FAILED') {
      return {
        ...base,
        tone: 'danger',
        kicker: 'Repository problem',
        headline: 'Repository setup failed',
        description:
          'GitHub did not confirm your repository. Matchmaking stays paused; contact an event admin to retry.',
      }
    }

    return base
  }

  if (phase === 'SUBMISSIONS_CLOSED') {
    return {
      phase,
      // A calm waiting state: nothing for participants to do until Showtime.
      tone: 'neutral',
      kicker: 'Code freeze',
      headline: viewer.team ? 'Your bot is locked in' : 'Bots are locked in',
      description:
        'Repositories are locked and the tournament is being prepared. Showtime starts when organizers are ready.',
      countdownTo: null,
      countdownLabel: null,
      // Tease the Showtime stream so people can open it before it goes live.
      actions: showtimeStream
        ? [{ kind: 'link', label: 'Showtime stream', href: showtimeStream }]
        : [],
    }
  }

  if (phase === 'SHOWCASE') {
    const actions: MomentAction[] = showtimeStream
      ? [{ kind: 'link', label: 'Watch stream', href: showtimeStream }]
      : []
    return {
      phase,
      tone: 'active',
      kicker: 'Live',
      headline: 'Showtime',
      description:
        'Organizers are presenting tournament games and revealing results.',
      countdownTo: null,
      countdownLabel: null,
      actions,
    }
  }

  return {
    phase,
    tone: 'neutral',
    kicker: 'Completed',
    headline: 'Event completed',
    description:
      'Thanks for taking part. Matches and results remain available.',
    countdownTo: null,
    countdownLabel: null,
    actions: [],
  }
}

/** Two most significant units, e.g. "2d 04h", "3h 12m", "12m 00s". */
export function formatCountdown(remainingMs: number) {
  const total = Math.max(0, Math.ceil(remainingMs / 1000))
  const days = Math.floor(total / 86_400)
  const hours = Math.floor((total % 86_400) / 3_600)
  const minutes = Math.floor((total % 3_600) / 60)
  const seconds = total % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  if (days > 0) return `${days}d ${pad(hours)}h`
  if (hours > 0) return `${hours}h ${pad(minutes)}m`
  return `${minutes}m ${pad(seconds)}s`
}
