// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import type { AxiosAdapter } from 'axios'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import axiosInstance from '@/app/actions/axios'
import { AuthProvider, useSession, useSignOutEverywhere } from '@/lib/auth'

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
