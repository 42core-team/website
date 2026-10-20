import { ChevronDown, Lock } from 'lucide-react'
import { Fragment, useEffect, useRef } from 'react'
import Link from '@/components/app-link'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { lifecycleLabels } from '@/lib/event-lifecycle'
import type { EventMoment } from '@/lib/event-moment'
import { formatCountdown, momentRemainingMs } from '@/lib/event-moment'
import type { EventTab } from '@/lib/event-tabs'
import { usePathname } from '@/lib/router-hooks'
import { cn } from '@/lib/utils'
import { MomentActions, toneStyles } from './shared'

function StatusCapsule({
  eventId,
  moment,
  now,
}: Readonly<{ eventId: string; moment: EventMoment; now: number }>) {
  const tone = toneStyles[moment.tone]
  const remaining = momentRemainingMs(moment, now)
  const detail =
    remaining !== null
      ? moment.phase === 'REGISTRATION'
        ? `starts in ${formatCountdown(remaining)}`
        : formatCountdown(remaining)
      : moment.phase === 'SHOWCASE'
        ? 'live'
        : null
  // An alert (its headline differs from the countdown) replaces the phase name
  // so it is readable without opening the popover. The red final minutes of
  // coding are not an alert and keep the phase name.
  const isAlert =
    moment.tone === 'danger' && moment.headline !== moment.countdownLabel
  const label = isAlert ? moment.headline : lifecycleLabels[moment.phase]
  const pulsing =
    moment.phase === 'SHOWCASE' ||
    moment.tone === 'warning' ||
    moment.tone === 'danger'

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Event status: ${label}. Show details`}
        className={cn(
          'inline-flex h-8 shrink-0 items-center gap-2 rounded-full border bg-background/60 pr-2 pl-3 text-xs font-medium transition-colors hover:bg-accent',
          tone.border,
        )}
      >
        <span className="relative flex size-2">
          {pulsing && (
            <span
              className={cn(
                'absolute inline-flex size-full animate-ping rounded-full opacity-60',
                tone.dot,
              )}
            />
          )}
          <span className={cn('relative size-2 rounded-full', tone.dot)} />
        </span>
        <span>{label}</span>
        {detail && (
          <span
            className={cn(
              'font-mono tabular-nums',
              tone.text,
              // The alert label is long; the popover still has the countdown.
              isAlert && 'hidden sm:inline',
            )}
          >
            {detail}
          </span>
        )}
        <ChevronDown
          className="size-3.5 text-muted-foreground"
          aria-hidden="true"
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div className="space-y-1">
          <p className={cn('text-xs font-medium', tone.text)}>
            {moment.kicker}
          </p>
          <p className="font-semibold tracking-tight">{moment.headline}</p>
          {remaining !== null && (
            <p className="text-sm">
              {moment.countdownLabel !== moment.headline && (
                <span className="text-muted-foreground">
                  {moment.countdownLabel}{' '}
                </span>
              )}
              <span className={cn('font-mono tabular-nums', tone.text)}>
                {formatCountdown(remaining)}
              </span>
            </p>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{moment.description}</p>
        <MomentActions eventId={eventId} actions={moment.actions} size="sm" />
      </PopoverContent>
    </Popover>
  )
}

function isTabActive(tab: EventTab, index: number, pathname: string) {
  // The first tab is the event overview and only matches exactly.
  if (index === 0) return pathname === tab.path || pathname === `${tab.path}/`
  return pathname === tab.path || pathname.startsWith(`${tab.path}/`)
}

function TabLink({
  tab,
  label = tab.name,
  active,
  className,
}: Readonly<{
  tab: EventTab
  label?: string
  active: boolean
  className?: string
}>) {
  const tabClassName = cn(
    'relative flex h-11 items-center gap-1.5 px-3 text-sm whitespace-nowrap transition-colors',
    'after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full',
    active
      ? 'font-medium text-foreground after:bg-foreground'
      : 'text-muted-foreground hover:text-foreground',
    className,
  )
  if (!tab.lockedReason)
    return (
      <Link
        href={tab.path}
        aria-current={active ? 'page' : undefined}
        className={tabClassName}
      >
        <span className="truncate">{label}</span>
      </Link>
    )
  if (!tab.disabled)
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={tab.path}
            aria-current={active ? 'page' : undefined}
            aria-label={`${tab.name} (${tab.lockedReason})`}
            className={tabClassName}
          >
            <Lock className="size-3.5 opacity-70" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent>{tab.lockedReason}</TooltipContent>
      </Tooltip>
    )
  // Disabled tabs are not links; they stay focusable so the reason is reachable.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="link"
          aria-disabled="true"
          aria-current={active ? 'page' : undefined}
          aria-label={`${tab.name} (${tab.lockedReason})`}
          tabIndex={0}
          className={cn(
            tabClassName,
            'cursor-not-allowed',
            !active && 'opacity-60 hover:text-muted-foreground',
          )}
        >
          <Lock className="size-3.5" aria-hidden="true" />
          <span className="truncate">{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{tab.lockedReason}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Second tier of the site header on event pages: the event tabs, led by the
 * event name as the Info tab, and the status capsule on the right.
 */
export default function EventHeader({
  eventId,
  eventName,
  moment,
  tabs,
  now,
}: Readonly<{
  eventId: string
  eventName: string
  moment: EventMoment
  tabs: EventTab[]
  now: number
}>) {
  const pathname = usePathname()
  const navRef = useRef<HTMLElement>(null)
  const tone = toneStyles[moment.tone]
  const needsAttention = moment.tone === 'warning' || moment.tone === 'danger'
  const [infoTab, ...otherTabs] = tabs
  const infoLink = (
    <TabLink
      tab={infoTab}
      label={eventName}
      active={isTabActive(infoTab, 0, pathname)}
      className="min-w-0 px-0 font-semibold text-foreground after:inset-x-0 md:text-base"
    />
  )

  useEffect(() => {
    navRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [pathname])

  return (
    <div
      className={cn(
        'sticky top-16 z-40 border-b bg-background/95 backdrop-blur',
        needsAttention && cn(tone.panel, tone.border),
      )}
    >
      <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 lg:grid-cols-[minmax(0,max-content)_minmax(0,1fr)_auto]">
        <div className="flex min-w-0 items-center lg:border-r lg:pr-3">
          {infoLink}
        </div>
        <nav
          ref={navRef}
          aria-label="Event navigation"
          className="order-last col-span-2 -mx-4 min-w-0 overflow-x-auto px-4 [scrollbar-width:none] lg:order-none lg:col-span-1 lg:mx-0 lg:px-0"
        >
          <TooltipProvider delayDuration={0}>
            <ul className="flex items-center">
              {otherTabs.map((tab, index) => (
                <Fragment key={tab.path}>
                  {index > 0 && tab.group !== otherTabs[index - 1].group && (
                    <li
                      aria-hidden="true"
                      className="mx-1 h-5 w-px shrink-0 bg-border"
                    />
                  )}
                  <li className="shrink-0">
                    <TabLink
                      tab={tab}
                      active={isTabActive(tab, index + 1, pathname)}
                    />
                  </li>
                </Fragment>
              ))}
            </ul>
          </TooltipProvider>
        </nav>
        <div className="flex justify-end">
          <StatusCapsule eventId={eventId} moment={moment} now={now} />
        </div>
      </div>
    </div>
  )
}
