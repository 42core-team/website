// @vitest-environment jsdom

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import type { AxiosAdapter } from 'axios'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import axiosInstance from '@/app/actions/axios'
import {
  AuthProvider,
  useSession,
  useSignOut,
  useSignOutEverywhere,
} from '@/lib/auth'

const user = {
  id: 'user-1',
  username: 'ada',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  profilePicture: '',
}

let routes: Record<string, number>
let calls: string[]
const originalAdapter = axiosInstance.defaults.adapter

beforeEach(() => {
  routes = {}
  calls = []
  const adapter: AxiosAdapter = async (config) => {
    const key = `${config.method?.toUpperCase()} ${config.url}`
    calls.push(key)
    const status = routes[key] ?? 404
    const response = {
      data: status === 200 ? user : null,
      status,
      statusText: String(status),
      headers: {},
      config,
    }
    if (status >= 400) {
      throw new AxiosError('failed', undefined, config, null, response)
    }
    return response
  }
  axiosInstance.defaults.adapter = adapter
})

afterEach(() => {
  cleanup()
  axiosInstance.defaults.adapter = originalAdapter
})

function renderWithProviders<T>(hook: () => T) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )
  return { queryClient, ...renderHook(hook, { wrapper }) }
}

describe('useSession', () => {
  it('is unauthenticated when /auth/me is 401 and the refresh fails', async () => {
    routes['GET /auth/me'] = 401
    routes['POST /auth/refresh'] = 401

    const { result } = renderWithProviders(() => useSession())

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'))
    expect(calls).toEqual(['GET /auth/me', 'POST /auth/refresh'])
  })

  it('becomes unauthenticated when a later refresh fails', async () => {
    routes['GET /auth/me'] = 200
    const { result } = renderWithProviders(() => useSession())
    await waitFor(() => expect(result.current.status).toBe('authenticated'))

    routes['GET /teams'] = 401
    routes['POST /auth/refresh'] = 401
    await act(() => axiosInstance.get('/teams').catch(() => undefined))

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'))
    expect(result.current.data).toBeNull()
  })
})

describe('ending the session', () => {
  const adminTeamsKey = ['event', 'event-1', 'teams', 'admin']

  it('drops cached data when the user signs out', async () => {
    routes['GET /auth/me'] = 200
    routes['POST /auth/logout'] = 204
    const { result, queryClient } = renderWithProviders(() => ({
      session: useSession(),
      signOut: useSignOut(),
    }))
    await waitFor(() =>
      expect(result.current.session.status).toBe('authenticated'),
    )
    queryClient.setQueryData(adminTeamsKey, [{ queueScore: 1200 }])

    routes['GET /auth/me'] = 401
    routes['POST /auth/refresh'] = 401
    await act(() => result.current.signOut.mutateAsync())

    expect(queryClient.getQueryData(adminTeamsKey)).toBeUndefined()
  })

  it('drops cached data when the session expires', async () => {
    routes['GET /auth/me'] = 200
    const { result, queryClient } = renderWithProviders(() => useSession())
    await waitFor(() => expect(result.current.status).toBe('authenticated'))
    queryClient.setQueryData(adminTeamsKey, [{ queueScore: 1200 }])

    routes['GET /teams'] = 401
    routes['POST /auth/refresh'] = 401
    await act(() => axiosInstance.get('/teams').catch(() => undefined))

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'))
    expect(queryClient.getQueryData(adminTeamsKey)).toBeUndefined()
  })

  it('discards a response that arrives after the sign-out', async () => {
    routes['GET /auth/me'] = 200
    routes['POST /auth/logout'] = 204
    const { result, queryClient } = renderWithProviders(() => ({
      session: useSession(),
      signOut: useSignOut(),
    }))
    await waitFor(() =>
      expect(result.current.session.status).toBe('authenticated'),
    )
    let respond: (teams: unknown[]) => void = () => undefined
    void queryClient
      .fetchQuery({
        queryKey: adminTeamsKey,
        queryFn: () =>
          new Promise<unknown[]>((resolve) => {
            respond = resolve
          }),
      })
      .catch(() => undefined)

    routes['GET /auth/me'] = 401
    routes['POST /auth/refresh'] = 401
    await act(() => result.current.signOut.mutateAsync())
    await act(async () => {
      respond([{ queueScore: 1200 }])
      await Promise.resolve()
    })

    expect(queryClient.getQueryData(adminTeamsKey)).toBeUndefined()
  })

  it('refetches an active query only once when it keeps failing', async () => {
    routes['GET /auth/me'] = 200
    routes['GET /teams'] = 200
    const { result } = renderWithProviders(() => ({
      session: useSession(),
      teams: useQuery({
        queryKey: ['teams'],
        queryFn: () => axiosInstance.get('/teams'),
      }),
    }))
    await waitFor(() => expect(result.current.teams.isSuccess).toBe(true))
    await waitFor(() =>
      expect(result.current.session.status).toBe('authenticated'),
    )

    routes['GET /teams'] = 401
    routes['POST /auth/refresh'] = 401
    await act(async () => {
      await result.current.teams.refetch()
    })

    const teamRequests = () =>
      calls.filter((call) => call === 'GET /teams').length
    await waitFor(() => expect(result.current.teams.isError).toBe(true))
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(result.current.session.status).toBe('unauthenticated')
    // The initial load, the failing refetch, and one refetch after the reset.
    expect(teamRequests()).toBe(3)
  })
})

describe('useSignOutEverywhere', () => {
  it('posts /auth/logout-all and leaves the user logged out', async () => {
    routes['GET /auth/me'] = 200
    routes['POST /auth/logout-all'] = 204
    const { result } = renderWithProviders(() => ({
      session: useSession(),
      signOutEverywhere: useSignOutEverywhere(),
    }))
    await waitFor(() =>
      expect(result.current.session.status).toBe('authenticated'),
    )

    routes['GET /auth/me'] = 401
    routes['POST /auth/refresh'] = 401
    await act(() => result.current.signOutEverywhere.mutateAsync())

    await waitFor(() =>
      expect(result.current.session.status).toBe('unauthenticated'),
    )
    expect(calls).toContain('POST /auth/logout-all')
  })
})
