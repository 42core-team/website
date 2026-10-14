import type { Event } from '@/app/actions/event'
import { useQuery } from '@tanstack/react-query'
import { Menu } from 'lucide-react'
import Link from '@/components/app-link'
import { usePathname } from '@/lib/router-hooks'
import { useEffect, useMemo, useState } from 'react'
import { myTeamQueryFn, myTeamQueryKey } from '@/app/events/my-team-queries'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { navigationMenuTriggerStyle } from '@/components/ui/navigation-menu'
import { cn } from '@/lib/utils'
import { readComponentsConfig } from '@/components/unit-builder/config'

interface EventNavbarProps {
  eventId: string
  isUserRegistered?: boolean
  hasTeam?: boolean
  isEventAdmin?: boolean
  event: Event
}

export default function EventNavbar({
  eventId,
  isUserRegistered = false,
  hasTeam = false,
  isEventAdmin = false,
  event,
}: Readonly<EventNavbarProps>) {
  const pathname = usePathname()
  const startsAtTime = new Date(event.startDate).getTime()
  const [now, setNow] = useState(() => Date.now())
  const hasStarted = now >= startsAtTime
  const { data: myTeam } = useQuery({
    queryKey: myTeamQueryKey(eventId),
    queryFn: () => myTeamQueryFn(eventId),
    enabled: isUserRegistered,
  })
  const effectiveHasTeam = myTeam === undefined ? hasTeam : Boolean(myTeam)
  const supportsUnitBuilder = readComponentsConfig(event.gameConfig) !== null

  useEffect(() => {
    if (hasStarted) return undefined

    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [hasStarted])

  const navItems = useMemo(() => {
    const items = [
      { name: 'Info', path: `/events/${eventId}` },
      { name: 'Teams', path: `/events/${eventId}/teams` },
    ]

    if (isUserRegistered) {
      items.push({ name: 'My Team', path: `/events/${eventId}/my-team` })

      if (hasStarted && supportsUnitBuilder) {
        items.push({
          name: 'Unit Builder',
          path: `/events/${eventId}/unit-builder`,
        })
      }

      if (hasStarted && effectiveHasTeam) {
        items.push({ name: 'Match Making', path: `/events/${eventId}/queue` })
        if (event.gamblingEnabled) {
          items.push({ name: 'Gambling', path: `/events/${eventId}/gambling` })
        }
      }
    }

    items.push(
      { name: 'Group Phase', path: `/events/${eventId}/groups` },
      { name: 'Tournament Tree', path: `/events/${eventId}/bracket` },
    )

    if (isEventAdmin) {
      items.push({ name: 'Dashboard', path: `/events/${eventId}/dashboard` })
    }

    return items
  }, [
    eventId,
    isUserRegistered,
    effectiveHasTeam,
    isEventAdmin,
    hasStarted,
    supportsUnitBuilder,
    event.gamblingEnabled,
  ])

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl items-center px-4 py-4">
      {/* Desktop navigation */}
      <nav
        aria-label="Event navigation"
        className="hidden min-w-0 w-full md:block"
      >
        <ul className="flex flex-wrap items-center justify-center gap-1">
          {navItems.map((item) => {
            const isActive =
              item.name === 'Info'
                ? pathname === item.path
                : pathname === item.path || pathname.startsWith(`${item.path}/`)
            return (
              <li key={item.path}>
                <Link
                  href={item.path}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    navigationMenuTriggerStyle(),
                    'px-3 xl:px-4',
                    isActive && 'bg-accent text-accent-foreground',
                  )}
                >
                  {item.name}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Mobile navigation dropdown */}
      <div className="flex md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="min-h-11"
              aria-label="Open event navigation menu"
            >
              <Menu className="size-5" />
              Event Menu
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-56 max-w-[calc(100vw-2rem)]"
          >
            {navItems.map((item) => {
              const isActive =
                item.name === 'Info'
                  ? pathname === item.path
                  : pathname === item.path ||
                    pathname.startsWith(`${item.path}/`)
              return (
                <DropdownMenuItem
                  key={item.path}
                  asChild
                  className={cn(
                    'min-h-11',
                    isActive && 'bg-accent text-accent-foreground',
                  )}
                >
                  <Link
                    href={item.path}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.name}
                  </Link>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
