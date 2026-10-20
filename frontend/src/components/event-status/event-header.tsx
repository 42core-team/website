import { ChevronDown, Lock } from 'lucide-react'
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
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

function statusText(moment: EventMoment, now: number) {
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
  return { remaining, detail, isAlert, label }
}

function StatusLine({
  eventId,
  moment,
  now,
}: Readonly<{ eventId: string; moment: EventMoment; now: number }>) {
  const tone = toneStyles[moment.tone]
  const { remaining, detail, isAlert, label } = statusText(moment, now)

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Event status: ${label}. Show details`}
        className="flex max-w-full items-center gap-1 rounded-sm text-xs whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
      >
        <span
          className={cn('truncate', isAlert && cn('font-medium', tone.text))}
        >
          {label}
        </span>
        {detail && (
          <>
            <span aria-hidden="true">·</span>
            <span className={cn('font-mono tabular-nums', tone.text)}>
              {detail}
            </span>
          </>
        )}
        <ChevronDown className="size-3 shrink-0" aria-hidden="true" />
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

const GAP_PX = 12

/**
 * The bar is one row (event identity | tabs) only when every tab fits next to
 * the identity block; otherwise the tabs move to their own row, so no tab is
 * ever cut off.
 */
function useSingleRowFit() {
  const containerRef = useRef<HTMLDivElement>(null)
  const identityRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLUListElement>(null)
  const [fits, setFits] = useState(true)

  useLayoutEffect(() => {
    const measure = () => {
      const container = containerRef.current
      const identity = identityRef.current
      const tabs = tabsRef.current
      if (!container || !identity || !tabs) return
      const style = getComputedStyle(container)
      const inner =
        container.clientWidth -
        Number.parseFloat(style.paddingLeft) -
        Number.parseFloat(style.paddingRight)
      // A hidden copy of the name and status line gives their natural width,
      // even while the visible ones are truncated or stretched.
      const identityWidth = Math.max(
        ...[...identity.querySelectorAll('[data-measure]')].map(
          (element) => element.getBoundingClientRect().width,
        ),
      )
      // Stripe and its gap, the divider (pr-3 + border), then the column gap.
      const needed =
        3 + GAP_PX + identityWidth + GAP_PX + 1 + GAP_PX + tabs.scrollWidth
      setFits(window.innerWidth >= 1024 && needed <= inner)
    }
    measure()
    const observer = new ResizeObserver(measure)
    for (const element of [
      containerRef.current,
      tabsRef.current,
      ...(identityRef.current?.querySelectorAll('[data-measure]') ?? []),
    ])
      if (element) observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { containerRef, identityRef, tabsRef, fits }
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
  const singleRow = useSingleRowFit()
  const tone = toneStyles[moment.tone]
  const needsAttention = moment.tone === 'warning' || moment.tone === 'danger'
  const [infoTab, ...otherTabs] = tabs
  const infoActive = isTabActive(infoTab, 0, pathname)
  const status = statusText(moment, now)

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
      <div
        ref={singleRow.containerRef}
        className={cn(
          'mx-auto grid w-full max-w-7xl gap-x-3 px-4',
          singleRow.fits
            ? 'grid-cols-[minmax(0,max-content)_minmax(0,1fr)]'
            : 'grid-cols-1',
        )}
      >
        {/* The event name is the Info tab; it sits on the tab-label line with
            the status line hanging below it. */}
        <div
          ref={singleRow.identityRef}
          className={cn(
            'relative flex h-[72px] min-w-0 gap-3 pt-[26px]',
            singleRow.fits && 'border-r pr-3',
          )}
        >
          <span
            aria-hidden="true"
            className={cn('mb-[22px] w-[3px] shrink-0 rounded-full', tone.dot)}
          />
          <div className="min-w-0">
            <Link
              href={infoTab.path}
              aria-current={infoActive ? 'page' : undefined}
              className="block truncate leading-5 font-semibold md:text-base"
            >
              {eventName}
            </Link>
            <div className="mt-1">
              <StatusLine eventId={eventId} moment={moment} now={now} />
            </div>
          </div>
          <div
            aria-hidden="true"
            className="invisible absolute top-0 left-0 flex flex-col items-start whitespace-nowrap"
          >
            <span data-measure className="font-semibold md:text-base">
              {eventName}
            </span>
            <span data-measure className="pr-4 text-xs">
              {status.label}
              {status.detail && (
                <span className="font-mono"> · {status.detail}</span>
              )}
            </span>
          </div>
          {infoActive && (
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-foreground"
            />
          )}
        </div>
        <nav
          ref={navRef}
          aria-label="Event navigation"
          className={cn(
            'min-w-0 overflow-x-auto [scrollbar-width:none]',
            // One row: tabs span the full bar height so their labels share the
            // name's line and their underline sits on the bar's edge.
            singleRow.fits ? '[&_li>*]:h-[72px]' : '-mx-4 border-t px-4',
          )}
        >
          <TooltipProvider delayDuration={0}>
            <ul
              ref={singleRow.tabsRef}
              className="flex h-full w-max items-center"
            >
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
      </div>
    </div>
  )
}
