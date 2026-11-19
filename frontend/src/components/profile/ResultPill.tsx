import type { ProfileMatchResult } from '@/app/actions/profile'
import { cn } from '@/lib/utils'

// The letters and colors of the event rankings' match history badges.
const LABELS: { [result in ProfileMatchResult]: string } = {
  WIN: 'W',
  LOSS: 'L',
  DRAW: 'T',
}

const NAMES: { [result in ProfileMatchResult]: string } = {
  WIN: 'Win',
  LOSS: 'Loss',
  DRAW: 'Tie',
}

export function ResultPill({
  result,
  title,
  className,
}: {
  result: ProfileMatchResult
  title?: string
  className?: string
}) {
  return (
    <span
      title={title ? `${NAMES[result]} ${title}` : NAMES[result]}
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-semibold',
        result === 'WIN' && 'bg-success-surface text-success',
        result === 'LOSS' && 'bg-destructive-surface text-destructive',
        result === 'DRAW' && 'bg-muted text-muted-foreground',
        className,
      )}
    >
      <span className="sr-only">{NAMES[result]}</span>
      <span aria-hidden>{LABELS[result]}</span>
    </span>
  )
}
