import type { EventMoment } from '@/lib/event-moment'
import { formatCountdown } from '@/lib/event-moment'
import { cn } from '@/lib/utils'
import {
  MomentActions,
  toneBorder,
  toneDot,
  tonePanel,
  toneText,
} from './shared'

/** Compact current-moment notice for event subpages; renders only when it adds information. */
export default function EventStatusStrip({
  eventId,
  moment,
  now,
}: Readonly<{ eventId: string; moment: EventMoment; now: number }>) {
  if (!moment.showStrip) return null

  const remaining = moment.countdownTo
    ? new Date(moment.countdownTo).getTime() - now
    : null

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-4">
      <aside
        role={moment.tone === 'danger' ? 'alert' : 'status'}
        className={cn(
          'flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between',
          tonePanel[moment.tone],
          toneBorder[moment.tone],
        )}
      >
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-medium">
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                toneDot[moment.tone],
              )}
            />
            {moment.headline}
            {remaining !== null && (
              <span
                className={cn('font-mono tabular-nums', toneText[moment.tone])}
              >
                {moment.countdownLabel !== moment.headline &&
                  `${moment.countdownLabel} `}
                {formatCountdown(remaining)}
              </span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">{moment.description}</p>
        </div>
        <MomentActions eventId={eventId} actions={moment.actions} size="sm" />
      </aside>
    </div>
  )
}
