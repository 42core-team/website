import type { ReactNode } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Building blocks shared by the admin list-and-detail pages. */

/** A small colour dot; `className` gives its background colour. */
export function Dot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('size-2 shrink-0 rounded-full', className)}
    />
  )
}

/** Single-select filter chips, each with an optional dot and a count. */
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
  labels,
  dots,
  count,
}: {
  label: string
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  labels: Record<T, string>
  dots: Partial<Record<T, string>>
  count: (option: T) => number
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option}
          size="sm"
          variant={value === option ? 'default' : 'outline'}
          className="rounded-full"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {dots[option] && <Dot className={dots[option]} />}
          {labels[option]}{' '}
          <span className="tabular-nums opacity-70">{count(option)}</span>
        </Button>
      ))}
    </div>
  )
}

/** A list column beside a flexible detail panel. */
export const listDetailGrid =
  'grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]'

/** A selectable row of a list column, marked `aria-current` when selected. */
export function ListRow({
  selected,
  onSelect,
  children,
}: {
  selected: boolean
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={selected || undefined}
        onClick={onSelect}
        className={cn(
          'flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none',
          selected && 'bg-muted',
        )}
      >
        {children}
      </button>
    </li>
  )
}

/** The name and a muted second line of a list row. */
export function RowText({
  title,
  detail,
  detailClassName,
}: {
  title: ReactNode
  detail: ReactNode
  detailClassName?: string
}) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-medium">{title}</span>
      <span
        className={cn(
          'block truncate text-xs text-muted-foreground',
          detailClassName,
        )}
      >
        {detail}
      </span>
    </span>
  )
}

export function ListEmpty({ children }: { children: ReactNode }) {
  return (
    <li className="px-3 py-6 text-center text-sm text-muted-foreground">
      {children}
    </li>
  )
}

/** A decorative avatar with initials while, or if, the image fails. */
export function EntityAvatar({
  src,
  fallback,
  square = false,
  className,
}: {
  src?: string
  fallback: string
  square?: boolean
  className?: string
}) {
  return (
    <Avatar
      aria-hidden
      className={cn('size-8 text-xs', square && 'rounded-md', className)}
    >
      <AvatarImage src={src} alt="" />
      <AvatarFallback className={cn(square && 'rounded-md')}>
        {fallback}
      </AvatarFallback>
    </Avatar>
  )
}

/** Up to two initials of a name, e.g. "Ada Lovelace" -> "AL". */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}
