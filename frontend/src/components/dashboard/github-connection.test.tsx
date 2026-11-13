// @vitest-environment jsdom
import type { EventGithubStatus } from '@/app/actions/event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getEventGithubStatus,
  getLinkableGithubInstallations,
  linkGithubInstallation,
} from '@/app/actions/event'
import { GithubConnection } from './github-connection'

vi.mock('@/app/actions/event', () => ({
  getEventGithubStatus: vi.fn(),
  getGithubAppInstallUrl: vi.fn(),
  getLinkableGithubInstallations: vi.fn(),
  linkGithubInstallation: vi.fn(),
}))

const notConnected: EventGithubStatus = {
  appAvailable: true,
  githubOrg: '',
  usesOrganizerToken: false,
  installation: null,
}

function renderConnection() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <GithubConnection eventId="event" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(getEventGithubStatus).mockReset()
  vi.mocked(getLinkableGithubInstallations).mockReset().mockResolvedValue([])
  vi.mocked(linkGithubInstallation).mockReset()
})
afterEach(cleanup)

describe('GithubConnection', () => {
  it('offers to connect an event without GitHub access', async () => {
    vi.mocked(getEventGithubStatus).mockResolvedValue(notConnected)
    renderConnection()
    expect(
      await screen.findByRole('button', { name: 'Connect GitHub App' }),
    ).toBeTruthy()
    expect(screen.getByText(/GitHub is not connected yet/)).toBeTruthy()
  })

  it('links an installation on an organization the user owns', async () => {
    vi.mocked(getEventGithubStatus)
      .mockResolvedValueOnce(notConnected)
      .mockResolvedValue({
        ...notConnected,
        githubOrg: 'core-org',
        installation: { accountLogin: 'core-org', status: 'active' },
      })
    vi.mocked(getLinkableGithubInstallations).mockResolvedValue([
      {
        installationId: 77,
        accountLogin: 'core-org',
        accountType: 'Organization',
      },
    ])
    vi.mocked(linkGithubInstallation).mockResolvedValue({ eventId: 'event' })
    renderConnection()
    fireEvent.click(await screen.findByRole('button', { name: 'Use core-org' }))
    expect(
      screen.getByRole('button', { name: 'Install on another organization' }),
    ).toBeTruthy()
    expect(await screen.findByText('Connected')).toBeTruthy()
    expect(linkGithubInstallation).toHaveBeenCalledWith('event', 77)
  })

  it('offers to retry a failed search for existing installations', async () => {
    vi.mocked(getEventGithubStatus).mockResolvedValue(notConnected)
    vi.mocked(getLinkableGithubInstallations)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([
        {
          installationId: 77,
          accountLogin: 'core-org',
          accountType: 'Organization',
        },
      ])
    renderConnection()
    expect(
      await screen.findByText(/Could not check for existing installations/),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('button', { name: 'Use core-org' }),
    ).toBeTruthy()
  })

  it('shows the installation status', async () => {
    vi.mocked(getEventGithubStatus).mockResolvedValue({
      ...notConnected,
      installation: { accountLogin: 'core-org', status: 'suspended' },
    })
    renderConnection()
    expect(await screen.findByText('Suspended')).toBeTruthy()
    expect(screen.getByText(/suspended on core-org/)).toBeTruthy()
  })

  it('reports a failed status request and retries it', async () => {
    vi.mocked(getEventGithubStatus)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(notConnected)
    renderConnection()
    expect(
      await screen.findByText('Failed to load the GitHub connection'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('button', { name: 'Connect GitHub App' }),
    ).toBeTruthy()
  })

  it('stays hidden for token events while the App is not configured', async () => {
    vi.mocked(getEventGithubStatus).mockResolvedValue({
      ...notConnected,
      appAvailable: false,
      usesOrganizerToken: true,
    })
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <GithubConnection eventId="event" />
      </QueryClientProvider>,
    )
    await vi.waitFor(() =>
      expect(getEventGithubStatus).toHaveBeenCalledTimes(1),
    )
    expect(container.textContent).toBe('')
  })
})
