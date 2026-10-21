import type { Event } from '@/app/actions/event'
import type { EventMoment } from '@/lib/event-moment'
import {
  formatCountdown,
  introTime,
  momentRemainingMs,
} from '@/lib/event-moment'
import { cn } from '@/lib/utils'
import {
  MomentActions,
  formatEventDateTime,
  formatEventTime,
  toneStyles,
  viewerTimeZone,
} from './shared'

function PanelMeta({
  event,
  moment,
  now,
}: Readonly<{ event: Event; moment: EventMoment; now: number }>) {
  const intro = introTime(event)
  const parts: string[] = []
  if (moment.countdownTo) parts.push(formatEventDateTime(moment.countdownTo))
  if (moment.phase === 'SUBMISSIONS_CLOSED')
    parts.push(`Frozen since ${formatEventDateTime(event.submissionDeadline)}`)
  if (moment.phase === 'REGISTRATION' && intro && intro.getTime() > now)
    parts.push(`Livestream intro ${formatEventTime(intro.toISOString(), now)}`)
  if (parts.length === 0) return null
  return (
    <p className="text-sm text-muted-foreground">
      {[...parts, viewerTimeZone()].join(' · ')}
    </p>
  )
}

/** The current moment on the Info page: headline, countdown and calls to action. */
export default function EventMomentCard({
  event,
  moment,
  now,
}: Readonly<{ event: Event; moment: EventMoment; now: number }>) {
  const remaining = momentRemainingMs(moment, now)
  const showCountdownLabel =
    moment.countdownLabel && moment.countdownLabel !== moment.headline

  return (
    <section
      aria-labelledby="event-moment-heading"
      className={cn(
        'flex h-full flex-col justify-between gap-4 rounded-xl border p-6 sm:p-8',
        toneStyles[moment.tone].panel,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p
            className={cn('text-sm font-medium', toneStyles[moment.tone].text)}
          >
            {moment.kicker}
          </p>
          <h2
            id="event-moment-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            {moment.headline}
          </h2>
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
          <MomentActions eventId={event.id} actions={moment.actions} />
        </div>
      </div>
    </section>
  )
}
