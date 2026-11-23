// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UserProfile } from '@/app/actions/profile'
import { profileQueryKeys } from '@/app/actions/profile'
import { removeUserImage } from '@/app/actions/user'
import { ProfileHeader } from './ProfileHeader'

vi.mock('@/app/actions/user', () => ({ removeUserImage: vi.fn() }))

afterEach(cleanup)

const profile: UserProfile = {
  user: {
    id: 'ada-id',
    username: 'ada',
    name: 'Ada Lovelace',
    profilePicture: null,
    picture: null,
    background: { large: 'cover.webp' },
    createdAt: '2025-07-01T00:00:00Z',
    tags: [],
    intra: null,
  },
  teams: [],
  summary: {
    record: { wins: 0, losses: 0, draws: 0 },
    form: [],
    streaks: { longestWin: 0, current: null },
    phases: [],
    activity: { since: '2025-07-01', days: [] },
    rivals: { nemesis: null, favourite: null, mostPlayed: null },
  },
  combat: {
    matches: 0,
    unitsSpawned: 0,
    unitsDestroyed: 0,
    damageTotal: 0,
    coresDestroyed: 0,
    wallsDestroyed: 0,
    gemsGained: 0,
    tilesTraveled: 0,
  },
}

describe('profile header artwork', () => {
  it.each([
    { viewerId: 'ada-id', canEdit: true },
    { viewerId: 'another-player', canEdit: false },
  ])('renders the team-sized cover for $viewerId', ({ viewerId, canEdit }) => {
    const { container } = render(
      <ProfileHeader profile={profile} viewerId={viewerId} />,
    )
    const cover = container.querySelector('img')
    expect(cover?.getAttribute('src')).toMatch(/\/cover\.webp$/)
    expect(cover?.parentElement?.classList.contains('aspect-[10/3]')).toBe(true)
    expect(cover?.parentElement?.classList.contains('h-20')).toBe(false)
    expect(
      Boolean(screen.queryByRole('button', { name: 'Edit profile picture' })),
    ).toBe(canEdit)
    expect(
      Boolean(screen.queryByRole('button', { name: 'Edit background' })),
    ).toBe(canEdit)
    expect(screen.queryByRole('button', { name: 'Add background' })).toBeNull()
  })

  it('returns to the team cover after the owner removes their background', async () => {
    const initialProfile: UserProfile = {
      ...profile,
      teams: [
        {
          id: 'team',
          name: 'Team',
          picture: null,
          background: { large: 'team-cover.webp' },
          repo: null,
          starterTemplate: null,
          createdAt: '2025-07-01T00:00:00Z',
          event: {
            id: 'event',
            name: 'Event',
            state: 'COMPLETED',
            startDate: '2025-07-01T00:00:00Z',
            scheduledEndDate: '2025-07-02T00:00:00Z',
          },
          members: [],
          record: profile.summary.record,
          swissRecord: profile.summary.record,
          finish: null,
        },
      ],
    }
    let updatedProfile = initialProfile
    vi.mocked(removeUserImage).mockImplementationOnce(async () => {
      updatedProfile = {
        ...initialProfile,
        user: { ...initialProfile.user, background: null },
      }
    })

    function HeaderWithProfileQuery() {
      const { data } = useQuery({
        queryKey: profileQueryKeys.profile(null, initialProfile.user.id),
        queryFn: async () => updatedProfile,
        initialData: initialProfile,
      })
      return <ProfileHeader profile={data} viewerId={data.user.id} />
    }

    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <HeaderWithProfileQuery />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit background' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }))
    const addBackground = await screen.findByRole('button', {
      name: 'Add background',
    })
    expect(removeUserImage).toHaveBeenCalledWith('background')
    expect(container.querySelector('img')?.getAttribute('src')).toMatch(
      /\/team-cover\.webp$/,
    )

    fireEvent.click(addBackground)
    expect(screen.getByLabelText('Choose background file')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remove image' })).toBeNull()
  })
})
