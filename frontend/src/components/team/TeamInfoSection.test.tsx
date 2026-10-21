// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Team } from '@/app/actions/team'
import { TeamInfoSection } from './TeamInfoSection'

vi.mock('@/lib/router-hooks', () => ({
  useParams: () => ({ id: 'event' }),
  useRouter: () => ({ back: vi.fn() }),
}))
vi.mock('./TeamAppearanceEditor', () => ({
  TeamAppearanceEditor: ({ kind = 'picture' }: { kind?: string }) => (
    <button type="button">Edit {kind}</button>
  ),
}))
vi.mock('./TeamInviteModal', () => ({ default: () => null }))
afterEach(cleanup)

const team = {
  id: 'team',
  name: 'Test team',
  repo: 'team-repository',
  tags: ['Campus'],
} as Team

function renderTeam(locked: boolean, githubOrg = 'core') {
  return render(
    <TeamInfoSection
      myTeam={{ ...team, locked }}
      githubOrg={githubOrg}
      teamMembers={[]}
      onLeaveTeam={vi.fn()}
      isLeaving={false}
      isRepoPending={false}
      isRepoCreating={false}
    />,
  )
}

describe('repository lock indicator', () => {
  it('places the red lock status inside the repository link, not beside team tags', () => {
    renderTeam(true)
    const link = screen.getByRole('link', {
      name: 'Open team-repository repository on GitHub (locked)',
    })
    const status = screen.getByLabelText('Repository locked')
    expect(screen.queryByText('Locked')).toBeNull()
    expect(link.contains(status)).toBe(true)
    expect(link.firstElementChild).toBe(status)
    expect(status.nextElementSibling?.textContent).toBe('team-repository')
    expect(link.className).toContain('text-destructive')
    expect(status.className).toContain('text-destructive')
    expect(screen.getByText('Campus')).toBeTruthy()
  })

  it('keeps unlocked repositories neutral without a lock status', () => {
    renderTeam(false)
    const link = screen.getByRole('link', {
      name: 'Open team-repository repository on GitHub',
    })
    expect(screen.queryByText('Locked')).toBeNull()
    expect(screen.queryByLabelText('Repository locked')).toBeNull()
    expect(link.className).not.toContain('text-destructive')
  })

  it('shows the lock beside the repository name even without a GitHub organization', () => {
    renderTeam(true, '')
    const name = screen.getByText('team-repository')
    const status = screen.getByLabelText('Repository locked')
    expect(name.parentElement?.contains(status)).toBe(true)
    expect(name.parentElement?.className).toContain('text-destructive')
  })
})

describe('closed roster', () => {
  it('keeps artwork editable while hiding roster changes', () => {
    render(
      <TeamInfoSection
        myTeam={{ ...team, locked: true }}
        canEdit={false}
        githubOrg="core"
        teamMembers={[]}
        onLeaveTeam={vi.fn()}
        isLeaving={false}
        isRepoPending={false}
        isRepoCreating={false}
      />,
    )
    expect(screen.getByRole('button', { name: 'Edit picture' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Edit background' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Invite Others/ })).toBeNull()
  })
})
