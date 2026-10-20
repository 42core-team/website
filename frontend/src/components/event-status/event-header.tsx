import { useEffect, useRef } from 'react'
import Link from '@/components/app-link'
import type { EventMoment } from '@/lib/event-moment'
import type { EventTab } from '@/lib/event-tabs'
import { lifecycleLabels } from '@/lib/event-lifecycle'
import { formatCountdown, momentRemainingMs } from '@/lib/event-moment'
import { usePathname } from '@/lib/router-hooks'
import { cn } from '@/lib/utils'
import { toneStyles } from './shared'

function PhasePill({
  moment,
  now,
}: Readonly<{ moment: EventMoment; now: number }>) {
  const remaining = momentRemainingMs(moment, now)
  const detail =
    remaining !== null
      ? moment.phase === 'REGISTRATION'
        ? `starts in ${formatCountdown(remaining)}`
        : `${formatCountdown(remaining)} left`
      : moment.phase === 'SHOWCASE'
        ? 'live'
        : null

  return (
    <span
      role="status"
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
        toneStyles[moment.tone].border,
      )}
    >
      <span className="relative flex size-2">
        {(moment.phase === 'SHOWCASE' || moment.tone === 'warning') && (
          <span
            className={cn(
              'absolute inline-flex size-full animate-ping rounded-full opacity-60',
              toneStyles[moment.tone].dot,
            )}
          />
        )}
        <span
          className={cn(
            'relative size-2 rounded-full',
            toneStyles[moment.tone].dot,
          )}
        />
      </span>
      <span>{lifecycleLabels[moment.phase]}</span>
      {detail && (
        <span className={cn('tabular-nums', toneStyles[moment.tone].text)}>
          {detail}
        </span>
      )}
    </span>
  )
}

function isTabActive(tab: EventTab, index: number, pathname: string) {
  // The first tab is the event overview and only matches exactly.
  if (index === 0) return pathname === tab.path || pathname === `${tab.path}/`
  return pathname === tab.path || pathname.startsWith(`${tab.path}/`)
}

/** Second tier of the site header on event pages: event identity, phase, and tabs. */
export default function EventHeader({
  eventName,
  moment,
  tabs,
  now,
}: Readonly<{
  eventName: string
  moment: EventMoment
  tabs: EventTab[]
  now: number
}>) {
  const pathname = usePathname()
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    navRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [pathname])

  return (
    <div className="sticky top-16 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 pt-3 lg:flex-row lg:items-center lg:gap-6 lg:pt-0">
        <div className="flex min-w-0 items-center gap-3">
          <p className="truncate font-semibold tracking-tight">{eventName}</p>
          <PhasePill moment={moment} now={now} />
        </div>
        <nav
          ref={navRef}
          aria-label="Event navigation"
          className="-mx-4 min-w-0 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:ml-auto lg:px-0"
        >
          <ul className="flex items-center gap-1">
            {tabs.map((tab, index) => {
              const active = isTabActive(tab, index, pathname)
              return (
                <li key={tab.path} className="shrink-0">
                  <Link
                    href={tab.path}
                    aria-current={active ? 'page' : undefined}
                    title={tab.hint}
                    className={cn(
                      'relative flex h-11 items-center gap-1.5 px-3 text-sm whitespace-nowrap transition-colors',
                      'after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full',
                      active
                        ? 'font-medium text-foreground after:bg-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                      tab.hint && !active && 'text-muted-foreground/60',
                    )}
                  >
                    {tab.name}
                    {tab.hint && (
                      <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {tab.hint}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </div>
  )
}
