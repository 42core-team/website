// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import type { AxiosAdapter } from 'axios'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import axiosInstance from '@/app/actions/axios'
import { NO_EVENT_ABILITIES, useEventAbilities } from './use-event-abilities'

const MODERATOR = {
  administer: false,
  viewUnrevealedResults: true,
  publish: false,
}

let responses: Record<string, { status: number; data?: unknown }>
let calls: string[]
const originalAdapter = axiosInstance.defaults.adapter

beforeEach(() => {
  responses = {}
  calls = []
  const adapter: AxiosAdapter = async (config) => {
    const key = `${config.method?.toUpperCase()} ${config.url}`
    calls.push(key)
    const { status, data = null } = responses[key] ?? { status: 404 }
    const response = {
      data,
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

function renderAbilities() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(() => useEventAbilities('event-1'), { wrapper })
}

describe('useEventAbilities', () => {
  it('loads the abilities of a signed-in user', async () => {
    responses['GET /auth/me'] = {
      status: 200,
      data: { id: 'user-1', username: 'ada' },
    }
    responses['GET event/event-1/abilities'] = { status: 200, data: MODERATOR }

    const { result } = renderAbilities()

    expect(result.current.isPending).toBe(true)
    expect(result.current.abilities).toEqual(NO_EVENT_ABILITIES)
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.abilities).toEqual(MODERATOR)
  })

  it('gives a guest no abilities without asking the API', async () => {
    responses['GET /auth/me'] = { status: 401 }
    responses['POST /auth/refresh'] = { status: 401 }

    const { result } = renderAbilities()

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.abilities).toEqual(NO_EVENT_ABILITIES)
    expect(calls).not.toContain('GET event/event-1/abilities')
  })

  it('hides everything when the abilities cannot be loaded', async () => {
    responses['GET /auth/me'] = {
      status: 200,
      data: { id: 'user-1', username: 'ada' },
    }
    responses['GET event/event-1/abilities'] = { status: 500 }

    const { result } = renderAbilities()

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.abilities).toEqual(NO_EVENT_ABILITIES)
  })
})
