// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Team } from '@/app/actions/team'
import { TeamProfileHeader } from './TeamProfileHeader'

vi.mock('@/lib/router-hooks', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
}))
afterEach(cleanup)

const team = {
  id: 'team',
  name: 'Test team',
  tags: [] as string[],
} as Team

describe('team profile header', () => {
  it('renders the cover banner when the team has a background', () => {
    const { container } = render(
      <TeamProfileHeader
        team={{ ...team, background: { large: 'background.webp' } } as Team}
      />,
    )
    expect(container.querySelector('img')).toBeTruthy()
    expect(container.innerHTML).toContain('aspect-[10/3]')
    expect(screen.getByRole('button', { name: 'Go back' })).toBeTruthy()
  })

  it('renders a compact neutral gradient instead of a picture when the team has no background', () => {
    const { container } = render(<TeamProfileHeader team={team} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.innerHTML).not.toContain('aspect-[10/3]')
    const banner = container.querySelector('div.h-20')
    expect(banner).toBeTruthy()
    expect(banner?.className).toContain('sm:h-28')
    expect(banner?.className).toContain('bg-gradient-to-br')
    expect(banner?.className).toContain('from-background')
    expect(banner?.className).toContain('via-card')
    expect(banner?.className).toContain('to-muted')
    expect(banner?.className).toContain('items-start')
    expect(banner?.className).toContain('pt-4')
    const back = screen.getByRole('button', { name: 'Go back' })
    expect(banner?.contains(back)).toBe(true)
  })
})
