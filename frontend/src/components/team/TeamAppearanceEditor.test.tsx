// @vitest-environment jsdom
import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Team } from '@/app/actions/team'
import { TeamAppearanceEditor } from './TeamAppearanceEditor'
vi.mock('@/app/actions/team', () => ({
  saveTeamImage: vi.fn(),
  removeTeamImage: vi.fn(),
}))
afterEach(cleanup)
describe('team appearance dialog', () => {
  it('opens from the picture edit icon and keeps file controls inside the dialog', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TeamAppearanceEditor
          team={{ id: 'team', name: 'Test team' } as Team}
          eventId="event"
        />
      </QueryClientProvider>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByLabelText('Choose picture file')).toBeNull()
    const picture = screen.getByText('TE')
    expect(
      screen
        .getByRole('button', { name: 'Edit team picture' })
        .contains(picture),
    ).toBe(true)
    fireEvent.click(picture)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByLabelText('Choose picture file')).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: 'Save image' })
        .hasAttribute('disabled'),
    ).toBe(true)
    expect(screen.queryByRole('group', { name: 'Image to edit' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

it('opens the background editor directly from the visible cover', () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TeamAppearanceEditor
        team={
          {
            id: 'team',
            name: 'Test team',
            background: { large: 'large.webp' },
          } as Team
        }
        eventId="event"
        kind="background"
      />
    </QueryClientProvider>,
  )
  expect(document.querySelector('img')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Edit team background' }))
  expect(screen.getByLabelText('Choose background file')).toBeTruthy()
  expect(screen.queryByLabelText('Choose picture file')).toBeNull()
  expect(screen.queryByRole('group', { name: 'Image to edit' })).toBeNull()
})

it('shows a compact neutral gradient cover when there is no background', () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TeamAppearanceEditor
        team={{ id: 'team', name: 'Test team', tags: [] as string[] } as Team}
        eventId="event"
        kind="background"
      />
    </QueryClientProvider>,
  )
  expect(document.querySelector('img')).toBeNull()
  const add = screen.getByRole('button', { name: 'Add team background' })
  expect(add.parentElement?.className).toContain('h-20')
  expect(add.parentElement?.className).toContain('sm:h-28')
  expect(add.parentElement?.className).toContain('bg-gradient-to-br')
  expect(add.parentElement?.className).toContain('from-background')
  expect(add.parentElement?.className).toContain('to-muted')
  expect(
    screen.queryByRole('button', { name: 'Edit team background' }),
  ).toBeNull()
  fireEvent.click(add)
  expect(screen.getByLabelText('Choose background file')).toBeTruthy()
})
