import { Check } from 'lucide-react'
import type { Event } from '@/app/actions/event'
import type { EventMoment } from '@/lib/event-moment'
import { LIFECYCLE_ORDER, lifecycleLabels } from '@/lib/event-lifecycle'
import { cn } from '@/lib/utils'
import { formatEventDateTime, toneStyles } from './shared'

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
      return formatEventDateTime(event.completedAt ?? event.scheduledEndDate)
  }
}

/** The phase stepper on the Info page. */
export default function EventTimelineCard({
  event,
  moment,
}: Readonly<{ event: Event; moment: EventMoment }>) {
  const current = LIFECYCLE_ORDER.indexOf(moment.phase)

  return (
    <section
      aria-labelledby="event-timeline-heading"
      className="overflow-hidden rounded-xl border bg-card"
    >
      <div className="space-y-8 p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="event-timeline-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Event timeline
          </h2>
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
    </section>
  )
}
