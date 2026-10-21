// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AnchorHTMLAttributes } from 'react'
import type { Event } from '@/app/actions/event'
import EventsView from '@/app/events/EventsView'

vi.mock('@/components/app-link', () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}))

vi.mock('@/lib/router-hooks', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

afterEach(cleanup)

const event: Event = {
  id: 'championship',
  name: 'CORE Game World Championship',
  startDate: '2099-11-06T12:00:00.000Z',
  endDate: '2099-11-07T12:00:00.000Z',
  minTeamSize: 1,
  maxTeamSize: 4,
  currentRound: 0,
  githubOrg: 'core-game',
  canCreateTeam: true,
  lockedAt: null,
  processQueue: true,
  maxQueueCredits: 5,
  queueCreditIntervalMinutes: 15,
  isPrivate: false,
  gamblingEnabled: false,
}

function renderPreview(description: string) {
  render(
    <EventsView
      allEvents={[{ ...event, description }]}
      myEvents={[]}
      isLoggedIn={false}
    />,
  )

  return screen.getByLabelText(`View details for ${event.name}`)
}

describe('featured event description', () => {
  it('shows plain text without Markdown syntax or formatting', () => {
    const preview = renderPreview(
      '# Your **bot** vs. the _world_\n\nWrite in `C` or `Go`. [Join us](https://example.com).\n\n- [x] ~~Register~~ &amp; compete',
    )

    expect(preview.textContent).toContain(
      'Your bot vs. the world Write in C or Go. Join us. Register & compete',
    )
    expect(preview.querySelector('strong, em, code, del, input')).toBeNull()
    expect(preview.querySelectorAll('a')).toHaveLength(0)
  })

  it('shortens long descriptions at a word boundary with an ellipsis', () => {
    const description = `${'Build your bot. '.repeat(20)}Final details.`
    const preview = renderPreview(description)
    const excerpt = preview.querySelector('.line-clamp-2')?.textContent ?? ''

    expect(excerpt).toBeTruthy()
    expect(excerpt.length).toBeLessThanOrEqual(160)
    expect(excerpt).toMatch(/\S…$/)
    expect(description.startsWith(excerpt.slice(0, -1))).toBe(true)
    expect(description[excerpt.length - 1]).toBe(' ')
    expect(preview.textContent).not.toContain('Final details.')
  })

  it.each([
    [
      'Use C++ with game_bot and score 2 * 3.',
      'Use C++ with game_bot and score 2 * 3.',
    ],
    [
      '[Register][signup]\n\n[signup]: https://example.com\n\n![CORE logo](logo.png)',
      'Register CORE logo',
    ],
    [
      '| Round | Time |\n| --- | --- |\n| Finals | 10:00 |',
      'Round Time Finals 10:00',
    ],
    ['a'.repeat(160), 'a'.repeat(160)],
    ['a'.repeat(161), `${'a'.repeat(159)}…`],
  ])(
    'preserves readable text and handles length limits: %j',
    (markdown, expected) => {
      const preview = renderPreview(markdown)

      expect(preview.querySelector('.line-clamp-2')?.textContent).toBe(expected)
    },
  )

  it.each(['', '---\n\n<!-- comment -->'])(
    'omits descriptions without visible text: %j',
    (description) => {
      const preview = renderPreview(description)

      expect(preview.querySelector('.line-clamp-2')).toBeNull()
    },
  )
})
