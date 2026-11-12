// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventMoment } from '@/lib/event-moment'
import type { EventTab } from '@/lib/event-tabs'
import EventHeader from './event-header'

vi.mock('@/components/app-link', () => ({
  default: ({
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string }) => (
    <a href={href} {...props} />
  ),
}))
vi.mock('@/lib/router-hooks', () => ({
  usePathname: () => '/events/e1/teams',
}))

const moment: EventMoment = {
  phase: 'PLAYING',
  tone: 'active',
  kicker: 'Coding',
  headline: 'Coding ends in',
  description: '',
  countdownTo: null,
  countdownLabel: null,
  actions: [],
}

const tabs: EventTab[] = [
  { name: 'Info', path: '/events/e1', group: 'info' },
  { name: 'Teams', path: '/events/e1/teams', group: 'teams' },
  {
    name: 'Match Making',
    path: '/events/e1/queue',
    group: 'team',
    lockedReason: 'Join a team first',
    disabled: true,
  },
]

let containerWidth = 0

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
    () => containerWidth,
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderHeader(overrides: Partial<EventMoment> = {}) {
  return render(
    <EventHeader
      eventName="Event"
      moment={{ ...moment, ...overrides }}
      tabs={tabs}
      now={0}
    />,
  )
}

describe('EventHeader', () => {
  it('wraps the tabs and offers a menu when they do not fit in one row', () => {
    containerWidth = 0
    renderHeader()
    expect(
      screen.getByRole('button', { name: 'Event sections, current: Teams' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('navigation', { name: 'Event navigation' }).className,
    ).toContain('sm:block')
    expect(screen.getByRole('list').className).toContain('flex-wrap')
  })

  it('shows one row without the menu when everything fits', () => {
    containerWidth = 4000
    renderHeader()
    expect(screen.queryByRole('button', { name: /Event sections/ })).toBeNull()
    expect(screen.getByRole('list').className).toContain('w-max')
  })

  it('keeps disabled tabs out of navigation and shows the reason on tap', async () => {
    renderHeader()
    const tab = screen.getByRole('link', {
      name: 'Match Making (Join a team first)',
    })
    expect(tab.tagName).toBe('SPAN')
    expect(tab.getAttribute('aria-disabled')).toBe('true')
    expect(tab.tabIndex).toBe(0)
    fireEvent.click(tab)
    expect(
      (await screen.findAllByText('Join a team first')).length,
    ).toBeGreaterThan(0)
  })

  it('keeps a solid background when the bar is tinted', () => {
    const { container } = renderHeader({ tone: 'danger' })
    const bar = container.firstElementChild as HTMLElement
    expect(bar.className).toContain('bg-background/95')
    expect(bar.querySelector('[aria-hidden="true"]')?.className).toContain(
      'bg-destructive',
    )
  })
})
