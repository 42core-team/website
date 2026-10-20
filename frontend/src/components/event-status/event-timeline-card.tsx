import { Check } from 'lucide-react'
import type { Event } from '@/app/actions/event'
import type { EventMoment } from '@/lib/event-moment'
import {
  formatCountdown,
  introTime,
  momentRemainingMs,
} from '@/lib/event-moment'
import { LIFECYCLE_ORDER, lifecycleLabels } from '@/lib/event-lifecycle'
import { cn } from '@/lib/utils'
import {
  MomentActions,
  formatEventDateTime,
  formatEventTime,
  toneStyles,
  viewerTimeZone,
} from './shared'

function stepDate(event: Event, phase: Event['state']) {
  switch (phase) {
    case 'REGISTRATION':
      return `Before ${formatEventDateTime(event.startDate)}`
    case 'PLAYING':
      return formatEventDateTime(event.startDate)
    case 'SUBMISSIONS_CLOSED':
      return formatEventDateTime(event.submissionDeadline)
    case 'SHOWCASE':
      return 'When organizers start'
    case 'COMPLETED':
      return event.completedAt
        ? formatEventDateTime(event.completedAt)
        : 'After the final reveal'
  }
}

function PanelMeta({
  event,
  moment,
  now,
}: Readonly<{ event: Event; moment: EventMoment; now: number }>) {
  const intro = introTime(event)
  const parts: string[] = []
  if (moment.countdownTo) parts.push(formatEventDateTime(moment.countdownTo))
  if (moment.phase === 'SUBMISSIONS_CLOSED')
    parts.push(`Closed ${formatEventDateTime(event.submissionDeadline)}`)
  if (moment.phase === 'REGISTRATION' && intro && intro.getTime() > now)
    parts.push(`Livestream intro ${formatEventTime(intro.toISOString(), now)}`)
  if (parts.length === 0) return null
  return (
    <p className="text-sm text-muted-foreground">
      {[...parts, viewerTimeZone()].join(' · ')}
    </p>
  )
}

/** Full event status for the Info page: phase stepper plus the current moment. */
export default function EventTimelineCard({
  event,
  moment,
  now,
}: Readonly<{ event: Event; moment: EventMoment; now: number }>) {
  const current = LIFECYCLE_ORDER.indexOf(moment.phase)
  const remaining = momentRemainingMs(moment, now)
  const showCountdownLabel =
    moment.countdownLabel && moment.countdownLabel !== moment.headline

  return (
    <section
      aria-labelledby="event-timeline-heading"
      className="overflow-hidden rounded-xl border bg-card"
    >
      <div className="space-y-8 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Event timeline</p>
            <h2
              id="event-timeline-heading"
              className="mt-1 text-xl font-semibold tracking-tight"
            >
              From first commit to final reveal
            </h2>
          </div>
          <span className="shrink-0 rounded-full border px-3 py-1 text-sm">
            {lifecycleLabels[moment.phase]}
          </span>
        </div>

        <ol className="grid gap-4 sm:grid-cols-5 sm:gap-2">
          {LIFECYCLE_ORDER.map((phase, index) => {
            const done = index < current
            const active = index === current
            return (
              <li
                key={phase}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'relative flex gap-3 sm:flex-col',
                  index < LIFECYCLE_ORDER.length - 1 &&
                    'sm:after:absolute sm:after:top-4 sm:after:right-3 sm:after:left-11 sm:after:h-px sm:after:bg-border',
                )}
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-sm tabular-nums',
                    active
                      ? cn(
                          'text-white ring-4',
                          toneStyles[moment.tone].dot,
                          toneStyles[moment.tone].ring,
                        )
                      : done
                        ? 'bg-muted text-foreground'
                        : 'bg-muted/50 text-muted-foreground',
                  )}
                >
                  {done ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </span>
                <div className="min-w-0 sm:pr-2">
                  <p
                    className={cn(
                      'font-medium',
                      !active && 'text-muted-foreground',
                    )}
                  >
                    {lifecycleLabels[phase]}
                  </p>
                  <p
                    className={cn(
                      'mt-0.5 text-sm',
                      active ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {stepDate(event, phase)}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      <div
        className={cn(
          'space-y-4 border-y p-6 sm:p-8',
          toneStyles[moment.tone].panel,
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p
              className={cn(
                'text-sm font-medium',
                toneStyles[moment.tone].text,
              )}
            >
              {moment.kicker}
            </p>
            <h3 className="text-2xl font-semibold tracking-tight">
              {moment.headline}
            </h3>
          </div>
          {remaining !== null && (
            <div className="sm:text-right">
              {showCountdownLabel && (
                <p className="text-sm text-muted-foreground">
                  {moment.countdownLabel}
                </p>
              )}
              <p
                role="timer"
                className={cn(
                  'font-mono text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl',
                  toneStyles[moment.tone].text,
                )}
              >
                {formatCountdown(remaining)}
              </p>
            </div>
          )}
        </div>
        <p className="max-w-2xl text-muted-foreground">{moment.description}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <PanelMeta event={event} moment={moment} now={now} />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            {moment.status && (
              <p className="text-sm font-medium">{moment.status}</p>
            )}
            <MomentActions eventId={event.id} actions={moment.actions} />
          </div>
        </div>
      </div>

      {/* Once completed, the estimate is meaningless; show the finish time if known. */}
      {(moment.phase !== 'COMPLETED' || event.completedAt) && (
        <div className="flex flex-col gap-2 p-6 sm:flex-row sm:items-end sm:justify-between sm:px-8">
          {event.completedAt ? (
            <div>
              <p className="text-sm text-muted-foreground">Event finished</p>
              <p className="font-medium">
                {formatEventDateTime(event.completedAt)}
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm text-muted-foreground">Scheduled end</p>
                <p className="font-medium">
                  {formatEventDateTime(event.scheduledEndDate)}
                </p>
              </div>
              <p className="max-w-xs text-sm text-muted-foreground sm:text-right">
                Estimate · completion follows the final reveal
              </p>
            </>
          )}
        </div>
      )}
    </section>
  )
}
