import type { Event } from '@/app/actions/event'
import type { Team } from '@/app/actions/team'
import { eventState } from '@/lib/event-lifecycle'

type Phase = Event['state']

export const PHASE_ORDER: Phase[] = [
  'REGISTRATION',
  'PLAYING',
  'SUBMISSIONS_CLOSED',
  'SHOWCASE',
  'COMPLETED',
]

export const DEADLINE_WARNING_MS = 3 * 60 * 60 * 1000

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
>

export interface MomentViewer {
  isRegistered: boolean
  team: Pick<Team, 'repositoryStatus'> | null
}

export type MomentTone = 'neutral' | 'active' | 'warning' | 'danger'

export type MomentAction =
  | { kind: 'join'; label: string }
  | { kind: 'link'; label: string; href: string; external?: boolean }

export interface EventMoment {
  phase: Phase
  tone: MomentTone
  eyebrow: string
  headline: string
  description: string
  /** ISO timestamp to count down to, if any, and what the countdown means. */
  countdownTo: string | null
  countdownLabel: string | null
  /** Short right-aligned status, e.g. "Waiting for coding to begin". */
  status: string | null
  actions: MomentAction[]
  /** Whether the compact strip on event subpages adds anything beyond the header pill. */
  showStrip: boolean
}

export type TournamentStage = 'groups' | 'bracket'

export function introTime(event: MomentEvent): Date | null {
  if (!event.introEnabled) return null
  return new Date(
    new Date(event.startDate).getTime() - event.introLeadMinutes * 60_000,
  )
}

/**
 * The single source for what the event status UI says right now:
 * headline, countdown, tone and call to action for this viewer.
 */
export function eventMoment(
  event: MomentEvent,
  viewer: MomentViewer,
  {
    now = Date.now(),
    tournamentStage = 'groups',
  }: { now?: number; tournamentStage?: TournamentStage } = {},
): EventMoment {
  const phase = eventState(event, now)
  const myTeamHref = `/events/${event.id}/my-team`

  if (phase === 'REGISTRATION' || phase === 'PLAYING') {
    const coding = phase === 'PLAYING'
    const deadlineMs = new Date(event.submissionDeadline).getTime() - now
    const closingSoon = coding && deadlineMs <= DEADLINE_WARNING_MS
    const base: EventMoment = {
      phase,
      tone: closingSoon ? 'warning' : 'active',
      eyebrow: coding ? (closingSoon ? 'Final hours' : 'Coding') : 'Get ready',
      headline: coding ? 'Coding ends in' : 'Coding starts in',
      description: coding
        ? 'Push to your repository and queue for matches. Repositories lock at the deadline.'
        : 'Form your team now. Repositories are created when coding starts.',
      countdownTo: coding ? event.submissionDeadline : event.startDate,
      countdownLabel: coding ? 'Coding ends in' : 'Coding starts in',
      status: coding ? null : 'Waiting for coding to begin',
      actions: [],
      showStrip: closingSoon,
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
        external: true,
      })
    }

    if (event.isPrivate && !viewer.isRegistered) {
      return {
        ...base,
        description:
          'This is a private event. Join it first, then create a team or accept an invite.',
        actions: [{ kind: 'join', label: 'Join event' }, ...base.actions],
        showStrip: true,
      }
    }

    if (viewer.isRegistered && !viewer.team) {
      return {
        ...base,
        description: 'Get started: create a team or join one with an invite.',
        actions: [
          { kind: 'link', label: 'My team', href: myTeamHref },
          ...base.actions,
        ],
        showStrip: true,
      }
    }

    if (viewer.team?.repositoryStatus === 'FAILED') {
      return {
        ...base,
        tone: 'danger',
        eyebrow: 'Repository problem',
        headline: 'Repository setup failed',
        description:
          'GitHub did not confirm your repository. Matchmaking stays paused; contact an event admin to retry.',
        actions: [{ kind: 'link', label: 'My team', href: myTeamHref }],
        showStrip: true,
      }
    }

    if (viewer.team && coding) {
      return {
        ...base,
        actions: [
          {
            kind: 'link',
            label: 'Match Making',
            href: `/events/${event.id}/queue`,
          },
        ],
      }
    }

    if (viewer.team) {
      return {
        ...base,
        actions: [
          { kind: 'link', label: 'My team', href: myTeamHref },
          ...base.actions,
        ],
      }
    }

    return base
  }

  if (phase === 'SUBMISSIONS_CLOSED') {
    return {
      phase,
      tone: 'warning',
      eyebrow: 'Coding closed',
      headline: 'Pencils down',
      description:
        'Repositories are being locked and the tournament is being prepared. Showtime starts when organizers are ready.',
      countdownTo: null,
      countdownLabel: null,
      status: 'Waiting for Showtime',
      actions: [],
      showStrip: true,
    }
  }

  if (phase === 'SHOWCASE') {
    const actions: MomentAction[] = []
    if (event.streamUrl)
      actions.push({
        kind: 'link',
        label: 'Watch stream',
        href: event.streamUrl,
        external: true,
      })
    actions.push(
      tournamentStage === 'bracket'
        ? {
            kind: 'link',
            label: 'Tournament Tree',
            href: `/events/${event.id}/bracket`,
          }
        : {
            kind: 'link',
            label: 'Group Phase',
            href: `/events/${event.id}/groups`,
          },
    )
    return {
      phase,
      tone: 'active',
      eyebrow: 'Live',
      headline: 'Showtime',
      description:
        'Organizers are presenting tournament games and revealing results.',
      countdownTo: null,
      countdownLabel: null,
      status: null,
      actions,
      showStrip: true,
    }
  }

  return {
    phase,
    tone: 'neutral',
    eyebrow: 'Completed',
    headline: 'Event completed',
    description:
      'Thanks for taking part. Matches and results remain available.',
    countdownTo: null,
    countdownLabel: null,
    status: null,
    actions: [],
    showStrip: false,
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
  const base = `/events/${event.id}`
  const opensHint = `Opens ${formatTime(event.startDate)}`
  const playHint =
    phase === 'REGISTRATION'
      ? opensHint
      : phase === 'PLAYING'
        ? undefined
        : 'Closed'

  const tabs: EventTab[] = [
    { name: 'Info', path: base },
    { name: 'Teams', path: `${base}/teams` },
  ]

  if (isRegistered) {
    tabs.push({ name: 'My Team', path: `${base}/my-team` })
    if (supportsUnitBuilder)
      tabs.push({
        name: 'Unit Builder',
        path: `${base}/unit-builder`,
        hint: phase === 'REGISTRATION' ? opensHint : undefined,
      })
    if (hasTeam) {
      tabs.push({ name: 'Match Making', path: `${base}/queue`, hint: playHint })
      if (event.gamblingEnabled)
        tabs.push({
          name: 'Gambling',
          path: `${base}/gambling`,
          hint: playHint,
        })
    }
  }

  if (
    isAdmin ||
    PHASE_ORDER.indexOf(phase) >= PHASE_ORDER.indexOf('SUBMISSIONS_CLOSED')
  )
    tabs.push(
      { name: 'Group Phase', path: `${base}/groups` },
      { name: 'Tournament Tree', path: `${base}/bracket` },
    )

  if (isAdmin) tabs.push({ name: 'Dashboard', path: `${base}/dashboard` })

  return tabs
}
