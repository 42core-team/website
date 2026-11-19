'use client'
import { userAvatarSrc } from '@/lib/user-avatar'
import type { HTMLAttributes, ReactNode, SVGAttributes } from 'react'
import { useSession, useSignOut } from '@/lib/auth'
import Link from '@/components/app-link'
import { usePathname, useRouter } from '@/lib/router-hooks'
import { forwardRef, useCallback, useState } from 'react'
import GithubLoginButton from '@/components/github'
import { ThemeSwitch } from '@/components/theme-switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
} from '@/components/ui/navigation-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useNavbar } from '@/contexts/NavbarContext'
import { cn } from '@/lib/utils'

function Logo(props: SVGAttributes<SVGElement>) {
  return (
    <svg viewBox="0 0 42 85" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g className="fill-link">
        <path d="M13 29L21 21V67L13 59V29Z" />
        <path d="M8 26L21 13V0L0 21V64L21 85V75L8 62L8 26Z" />
      </g>
      <g className="fill-link/70">
        <path d="M29 29L21 21V67L29 59V29Z" />
        <path d="M42 64L21 85V75L34 62L34 54L42 46V64Z" />
        <path d="M42 21V30L34 39L34 26L21 13V0L42 21Z" />
      </g>
    </svg>
  )
}

function HamburgerIcon({ className, ...props }: SVGAttributes<SVGElement>) {
  return (
    <svg
      className={cn('pointer-events-none', className)}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M4 12L20 12"
        className="origin-center -translate-y-1.75 transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.1)] group-aria-expanded:translate-x-0 group-aria-expanded:translate-y-0 group-aria-expanded:rotate-315"
      />
      <path
        d="M4 12H20"
        className="origin-center transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.8)] group-aria-expanded:rotate-45"
      />
      <path
        d="M4 12H20"
        className="origin-center translate-y-[7px] transition-all duration-300 ease-[cubic-bezier(.5,.85,.25,1.1)] group-aria-expanded:translate-y-0 group-aria-expanded:rotate-135"
      />
    </svg>
  )
}
// Types
export interface NavbarProps extends HTMLAttributes<HTMLElement> {
  session?: any
  /** Shown after the logo. */
  leading?: ReactNode
  /** Replaces the centered desktop nav links. */
  center?: ReactNode
  /** Shown before the theme switch. */
  actions?: ReactNode
}

export const Navbar = forwardRef<HTMLElement, NavbarProps>(
  ({ className, session, leading, center, actions, ...props }, ref) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isProfileOpen, setIsProfileOpen] = useState(false)
    const pathname = usePathname()
    const router = useRouter()
    const { setIsBasicNavbarMenuOpen } = useNavbar()
    const { data: currentSession, status } = useSession()
    const signOutMutation = useSignOut()
    const effectiveSession = session ?? currentSession
    const user = effectiveSession?.user
    const displayName = user?.name || user?.username || 'User'
    const initials = displayName.slice(0, 2).toUpperCase()

    const navLinks = [
      { href: '/', label: 'Home' },
      { href: '/events', label: 'Events' },
      { href: '/wiki', label: 'Wiki' },
      { href: '/changelog', label: 'Changelog' },
      { href: '/about', label: 'About us' },
    ]

    const isActive = useCallback(
      (path: string) => {
        if (path === '/events') {
          return pathname === '/events' || pathname.startsWith('/events/')
        }
        if (path === '/wiki') {
          return pathname.startsWith('/wiki')
        }
        return pathname === path
      },
      [pathname],
    )

    return (
      <header
        ref={ref}
        className={cn(
          'sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur **:no-underline',
          className,
        )}
        {...props}
      >
        <div className="page-frame page-workspace flex min-h-(--navbar-height) flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2 sm:py-0">
          {/* Left side */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Mobile menu trigger */}
            <div className="md:hidden">
              <Popover
                open={isMobileMenuOpen}
                onOpenChange={(open) => {
                  setIsMobileMenuOpen(open)
                  setIsBasicNavbarMenuOpen(open)
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    className="group"
                    aria-label="Site navigation"
                    variant="ghost"
                    size="icon"
                  >
                    <HamburgerIcon />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-3">
                  <nav className="mt-1 flex flex-col gap-1">
                    {navLinks.map((link) => (
                      <Link
                        key={link.href}
                        className={cn(
                          'rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                          isActive(link.href) &&
                            'bg-accent font-semibold text-accent-foreground',
                        )}
                        href={link.href}
                        aria-current={isActive(link.href) ? 'page' : undefined}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </nav>
                </PopoverContent>
              </Popover>
            </div>
            {/* Brand */}
            <Link href="/" className="flex items-center">
              <Logo className="size-7" aria-hidden="true" />
              <span className="ml-1 text-sm font-bold text-foreground">
                CORE
              </span>
            </Link>
            {leading}
          </div>

          {/* Desktop nav (centered) */}
          {center ?? (
            <NavigationMenu className="hidden flex-1 justify-center md:flex">
              <NavigationMenuList className="gap-2">
                {navLinks.map((link) => (
                  <NavigationMenuItem key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={isActive(link.href) ? 'page' : undefined}
                      className={cn(
                        'inline-flex min-h-11 items-center justify-center rounded-md border-b-2 border-transparent px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                        isActive(link.href)
                          ? 'border-link text-link'
                          : 'text-foreground/80 hover:text-foreground',
                      )}
                    >
                      {link.label}
                    </Link>
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          )}

          {/* Right side */}
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
            {actions}
            <ThemeSwitch />
            {user?.id ? (
              <Popover open={isProfileOpen} onOpenChange={setIsProfileOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="grid size-11 place-items-center rounded-full"
                    aria-label="Account menu"
                  >
                    <Avatar className="size-10 transition-transform">
                      <AvatarImage
                        src={userAvatarSrc(user)}
                        alt={displayName}
                      />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-52 p-2">
                  <button
                    className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      setIsProfileOpen(false)
                      router.push('/profile')
                    }}
                  >
                    Profile
                  </button>
                  <button
                    className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      setIsProfileOpen(false)
                      router.push('/settings')
                    }}
                  >
                    Settings
                  </button>
                  {effectiveSession?.user.abilities.admin && (
                    <div
                      className="my-1 border-y py-1"
                      role="group"
                      aria-label="Administration"
                    >
                      <p className="px-3 py-1 text-xs font-medium text-muted-foreground">
                        Administration
                      </p>
                      {[
                        { href: '/admin/roles', label: 'Users' },
                        { href: '/admin/presets', label: 'Presets' },
                        {
                          href: '/admin/github-installations',
                          label: 'GitHub installations',
                        },
                      ].map(({ href, label }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setIsProfileOpen(false)}
                          aria-current={pathname === href ? 'page' : undefined}
                          className="block rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                        >
                          {label}
                        </Link>
                      ))}
                    </div>
                  )}
                  <button
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      setIsProfileOpen(false)
                      void signOutMutation
                        .mutateAsync()
                        .catch(() => undefined)
                        .then(() => router.push('/'))
                    }}
                  >
                    Log Out
                  </button>
                </PopoverContent>
              </Popover>
            ) : status === 'loading' ? (
              <div className="h-9 w-20" />
            ) : (
              <GithubLoginButton />
            )}
          </div>
        </div>
      </header>
    )
  },
)
Navbar.displayName = 'Navbar'
export default Navbar
export { HamburgerIcon, Logo }
