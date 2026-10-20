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
  // An alert replaces the phase name so it is readable without opening the popover.
  const label =
    moment.tone === 'danger' ? moment.headline : lifecycleLabels[moment.phase]
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
          <span className={cn('font-mono tabular-nums', tone.text)}>
            {detail}
          </span>
        )}
        <ChevronDown
          className="size-3.5 text-muted-foreground"
          aria-hidden="true"
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
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
        {moment.status && <p className="text-sm">{moment.status}</p>}
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
  active,
}: Readonly<{ tab: EventTab; active: boolean }>) {
  const link = (
    <Link
      href={tab.path}
      aria-current={active ? 'page' : undefined}
      aria-label={
        tab.lockedReason ? `${tab.name} (${tab.lockedReason})` : undefined
      }
      className={cn(
        'relative flex h-11 items-center gap-1.5 px-3 text-sm whitespace-nowrap transition-colors',
        'after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full',
        active
          ? 'font-medium text-foreground after:bg-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {tab.lockedReason && (
        <Lock className="size-3.5 opacity-70" aria-hidden="true" />
      )}
      {tab.name}
    </Link>
  )
  if (!tab.lockedReason) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent>{tab.lockedReason}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Second tier of the site header on event pages: the current moment
 * (status capsule + primary action) and the event tabs in one bar.
 */
export default function EventHeader({
  eventId,
  moment,
  tabs,
  now,
}: Readonly<{
  eventId: string
  moment: EventMoment
  tabs: EventTab[]
  now: number
}>) {
  const pathname = usePathname()
  const navRef = useRef<HTMLElement>(null)
  const tone = toneStyles[moment.tone]
  const needsAttention = moment.tone === 'warning' || moment.tone === 'danger'
  // The primary action never points to the page you are already on.
  const primary = moment.actions.find(
    (action) => action.kind !== 'link' || action.href !== pathname,
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
      <div className="mx-auto grid w-full max-w-7xl grid-cols-[1fr_auto] items-center gap-x-3 px-4 pt-2 md:grid-cols-[auto_1fr_auto] md:pt-0">
        <div className="min-w-0">
          <StatusCapsule eventId={eventId} moment={moment} now={now} />
        </div>
        <nav
          ref={navRef}
          aria-label="Event navigation"
          className="order-last col-span-2 -mx-4 min-w-0 overflow-x-auto px-4 [scrollbar-width:none] md:order-none md:col-span-1 md:mx-0 md:px-0"
        >
          <TooltipProvider delayDuration={0}>
            <ul className="flex items-center">
              {tabs.map((tab, index) => (
                <Fragment key={tab.path}>
                  {index > 0 && tab.group !== tabs[index - 1].group && (
                    <li
                      aria-hidden="true"
                      className="mx-1 h-5 w-px shrink-0 bg-border"
                    />
                  )}
                  <li className="shrink-0">
                    <TabLink
                      tab={tab}
                      active={isTabActive(tab, index, pathname)}
                    />
                  </li>
                </Fragment>
              ))}
            </ul>
          </TooltipProvider>
        </nav>
        <div className="flex justify-end">
          {primary && (
            <MomentActions eventId={eventId} actions={[primary]} size="sm" />
          )}
        </div>
      </div>
    </div>
  )
}
