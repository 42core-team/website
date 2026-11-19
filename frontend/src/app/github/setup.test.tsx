// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type * as Router from '@tanstack/react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { completeGithubAppInstallation } from '@/app/actions/event'
import { GithubSetupPage } from '@/routes/github/setup'

const navigate = vi.fn()
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof Router>()),
  useNavigate: () => navigate,
}))
vi.mock('@/app/actions/event', () => ({
  completeGithubAppInstallation: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({
  useSession: () => ({ status: 'authenticated' }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))
vi.mock('@/components/app-link', () => ({
  default: ({
    href,
    children,
  }: {
    href: string
    children: React.ReactNode
  }) => <a href={href}>{children}</a>,
}))

function mount(eventId: string | null) {
  vi.mocked(completeGithubAppInstallation).mockResolvedValue({ eventId })
  const client = new QueryClient()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  render(
    <QueryClientProvider client={client}>
      <GithubSetupPage installationId={77} setupAction="install" state="s" />
    </QueryClientProvider>,
  )
  return invalidate
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('GitHub setup', () => {
  it('returns an admin install to the installations list', async () => {
    const invalidate = mount(null)
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/admin/github-installations',
        replace: true,
      }),
    )
    expect(completeGithubAppInstallation).toHaveBeenCalledWith(77, 's')
    expect(toast.success).toHaveBeenCalledWith('GitHub App installed.')
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['admin', 'github-installations'],
    })
  })

  it('returns an event install to its dashboard', async () => {
    mount('event')
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/events/$id/dashboard',
        params: { id: 'event' },
        replace: true,
      }),
    )
    expect(toast.success).toHaveBeenCalledWith('GitHub connected.')
  })
})
