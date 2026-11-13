// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { AxiosError } from 'axios'
import type { AxiosAdapter } from 'axios'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import axiosInstance from '@/app/actions/axios'
import {
  eventAbilitiesQueryKey,
  NO_EVENT_ABILITIES,
  useEventAbilities,
} from './use-event-abilities'

const MODERATOR = {
  administer: false,
  viewUnrevealedResults: true,
  publish: false,
}

type Response = { status: number; data?: unknown }
let responses: Record<string, Response | Promise<Response>>
let calls: string[]
const originalAdapter = axiosInstance.defaults.adapter

beforeEach(() => {
  responses = {}
  calls = []
  const adapter: AxiosAdapter = async (config) => {
    const key = `${config.method?.toUpperCase()} ${config.url}`
    calls.push(key)
    const { status, data = null } = await (responses[key] ?? { status: 404 })
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
  return {
    queryClient,
    ...renderHook(({ eventId }) => useEventAbilities(eventId), {
      wrapper,
      initialProps: { eventId: 'event-1' },
    }),
  }
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

  it('hides controls until the signed-in user’s abilities arrive', async () => {
    responses['GET /auth/me'] = {
      status: 200,
      data: { id: 'user-1', username: 'ada' },
    }
    let respond!: (response: Response) => void
    responses['GET event/event-1/abilities'] = new Promise((resolve) => {
      respond = resolve
    })
    const { result } = renderAbilities()

    await waitFor(() => expect(calls).toContain('GET event/event-1/abilities'))
    expect(result.current.isPending).toBe(true)
    expect(result.current.abilities).toEqual(NO_EVENT_ABILITIES)

    await act(async () => respond({ status: 200, data: MODERATOR }))
    await waitFor(() => expect(result.current.abilities).toEqual(MODERATOR))
  })

  it('hides cached controls if reloading abilities fails', async () => {
    responses['GET /auth/me'] = {
      status: 200,
      data: { id: 'user-1', username: 'ada' },
    }
    responses['GET event/event-1/abilities'] = { status: 200, data: MODERATOR }
    const { result, queryClient } = renderAbilities()
    await waitFor(() => expect(result.current.abilities).toEqual(MODERATOR))

    responses['GET event/event-1/abilities'] = { status: 500 }
    await act(() =>
      queryClient.refetchQueries({
        queryKey: eventAbilitiesQueryKey('event-1', 'user-1'),
      }),
    )

    await waitFor(() =>
      expect(result.current.abilities).toEqual(NO_EVENT_ABILITIES),
    )
    expect(result.current.isPending).toBe(false)
  })

  it('does not carry abilities into another event', async () => {
    responses['GET /auth/me'] = {
      status: 200,
      data: { id: 'user-1', username: 'ada' },
    }
    responses['GET event/event-1/abilities'] = { status: 200, data: MODERATOR }
    const { result, rerender } = renderAbilities()
    await waitFor(() => expect(result.current.abilities).toEqual(MODERATOR))

    rerender({ eventId: 'event-2' })

    expect(result.current.isPending).toBe(true)
    expect(result.current.abilities).toEqual(NO_EVENT_ABILITIES)
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.abilities).toEqual(NO_EVENT_ABILITIES)
  })

  it('drops abilities on sign-out and loads them separately for the next user', async () => {
    responses['GET /auth/me'] = {
      status: 200,
      data: { id: 'user-1', username: 'ada' },
    }
    responses['GET event/event-1/abilities'] = { status: 200, data: MODERATOR }
    const { result, queryClient } = renderAbilities()
    await waitFor(() => expect(result.current.abilities).toEqual(MODERATOR))
    calls = []

    await act(async () => {
      queryClient.setQueryData(['auth', 'session'], null)
    })
    await waitFor(() =>
      expect(result.current.abilities).toEqual(NO_EVENT_ABILITIES),
    )
    expect(result.current.isPending).toBe(false)
    expect(calls).toEqual([])

    responses['GET event/event-1/abilities'] = {
      status: 200,
      data: NO_EVENT_ABILITIES,
    }
    await act(async () => {
      queryClient.setQueryData(['auth', 'session'], { user: { id: 'user-2' } })
    })
    await waitFor(() => expect(calls).toEqual(['GET event/event-1/abilities']))
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.abilities).toEqual(NO_EVENT_ABILITIES)
  })
})
