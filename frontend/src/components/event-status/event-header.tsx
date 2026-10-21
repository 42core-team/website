import { ChevronDown, Lock } from 'lucide-react'
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from '@/components/app-link'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { toneStyles } from './shared'

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
  return { detail, isAlert, label }
}

function StatusLine({
  moment,
  now,
}: Readonly<{ moment: EventMoment; now: number }>) {
  const tone = toneStyles[moment.tone]
  const { detail, isAlert, label } = statusText(moment, now)

  return (
    <span className="flex max-w-full items-center justify-center gap-1 text-xs font-normal whitespace-nowrap text-muted-foreground">
      <span className={cn('truncate', isAlert && cn('font-medium', tone.text))}>
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
    </span>
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
    'flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors',
    active
      ? 'bg-accent text-accent-foreground'
      : 'text-foreground/80 hover:bg-accent hover:text-accent-foreground',
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
            !active &&
              'opacity-60 hover:bg-transparent hover:text-foreground/80',
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

/** The event tabs as a menu, for screens too narrow to show them all. */
function EventTabsMenu({
  tabs,
  pathname,
}: Readonly<{ tabs: EventTab[]; pathname: string }>) {
  const activeTab = tabs.find((tab, index) =>
    isTabActive(tab, index + 1, pathname),
  )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 sm:hidden">
          {activeTab?.name ?? 'Sections'}
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {tabs.map((tab, index) => (
          <Fragment key={tab.path}>
            {index > 0 && tab.group !== tabs[index - 1].group && (
              <DropdownMenuSeparator />
            )}
            <DropdownMenuItem
              asChild={!tab.disabled}
              disabled={tab.disabled}
              className={cn(tab === activeTab && 'bg-accent font-medium')}
            >
              {tab.disabled ? (
                <TabsMenuLabel tab={tab} />
              ) : (
                <Link
                  href={tab.path}
                  aria-current={tab === activeTab ? 'page' : undefined}
                >
                  <TabsMenuLabel tab={tab} />
                </Link>
              )}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TabsMenuLabel({ tab }: Readonly<{ tab: EventTab }>) {
  return (
    <>
      {tab.lockedReason && <Lock className="size-3.5" aria-hidden="true" />}
      <span>{tab.name}</span>
      {tab.lockedReason && (
        <span className="ml-auto text-xs text-muted-foreground">
          {tab.lockedReason}
        </span>
      )}
    </>
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
      // Pill padding, stripe and its gap, the divider (pr-3 + border), then
      // the column gap.
      // The tabs may be wrapped, so add up their natural widths instead.
      const tabsWidth = [...tabs.children].reduce((sum, element, index) => {
        const itemStyle = getComputedStyle(element)
        return (
          sum +
          element.getBoundingClientRect().width +
          Number.parseFloat(itemStyle.marginLeft) +
          Number.parseFloat(itemStyle.marginRight) +
          (index > 0 ? Number.parseFloat(getComputedStyle(tabs).columnGap) : 0)
        )
      }, 0)
      const needed =
        2 * GAP_PX + 3 + 10 + identityWidth + GAP_PX + 1 + GAP_PX + tabsWidth
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
 * Second tier of the site header on event pages: the event name and its
 * status line (together the Info tab), followed by the event tabs.
 */
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
        'sticky top-16 z-40 border-b bg-background/95 px-4 backdrop-blur md:px-6',
        needsAttention && cn(tone.panel, tone.border),
      )}
    >
      <div
        ref={singleRow.containerRef}
        className={cn(
          'container mx-auto grid max-w-(--breakpoint-2xl) gap-x-3',
          singleRow.fits
            ? 'grid-cols-[minmax(0,max-content)_minmax(0,max-content)] justify-center'
            : 'grid-cols-1',
        )}
      >
        {/* The event name and its status line form the Info tab. */}
        <div
          ref={singleRow.identityRef}
          className={cn(
            'relative flex h-14 min-w-0 items-center',
            singleRow.fits
              ? 'justify-self-center border-r pr-3'
              : 'justify-between gap-3 sm:justify-self-center',
          )}
        >
          <Link
            href={infoTab.path}
            aria-current={infoActive ? 'page' : undefined}
            className={cn(
              'flex min-w-0 items-stretch gap-2.5 rounded-md px-3 py-1.5 transition-colors',
              infoActive ? 'bg-accent' : 'hover:bg-accent',
            )}
          >
            <span
              aria-hidden="true"
              className={cn('w-[3px] shrink-0 rounded-full', tone.dot)}
            />
            <span className="flex min-w-0 flex-col items-center text-center">
              <span className="max-w-full truncate text-sm leading-5 font-semibold">
                {eventName}
              </span>
              <StatusLine moment={moment} now={now} />
            </span>
          </Link>
          <div
            aria-hidden="true"
            className="invisible absolute top-0 left-0 flex flex-col items-start whitespace-nowrap"
          >
            <span data-measure className="text-sm font-semibold">
              {eventName}
            </span>
            <span data-measure className="text-xs">
              {status.label}
              {status.detail && (
                <span className="font-mono"> · {status.detail}</span>
              )}
            </span>
          </div>
          {!singleRow.fits && (
            <EventTabsMenu tabs={otherTabs} pathname={pathname} />
          )}
        </div>
        <nav
          ref={navRef}
          aria-label="Event navigation"
          className={cn(
            'min-w-0',
            singleRow.fits
              ? 'flex items-center'
              : // Phones use the menu; wider screens wrap the tabs, so none
                // is ever cut off or needs horizontal scrolling.
                '-mx-4 hidden border-t px-4 py-2 sm:block md:-mx-6 md:px-6',
          )}
        >
          <TooltipProvider delayDuration={0}>
            <ul
              ref={singleRow.tabsRef}
              className={cn(
                'flex items-center gap-1',
                singleRow.fits ? 'w-max' : 'flex-wrap justify-center',
              )}
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
