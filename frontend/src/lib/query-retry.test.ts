import { QueryClient } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { retryUnlessStatus } from './query-retry'

function apiError(status: number) {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    data: {},
    headers: {},
    config,
  })
}

async function attempts(error: unknown) {
  const queryFn = vi.fn().mockRejectedValue(error)
  await new QueryClient()
    .fetchQuery({
      queryKey: ['match'],
      queryFn,
      retry: retryUnlessStatus(404),
      retryDelay: 0,
    })
    .catch(() => undefined)
  return queryFn.mock.calls.length
}

describe('retryUnlessStatus', () => {
  it('does not retry when the API answers 404', async () => {
    expect(await attempts(apiError(404))).toBe(1)
  })

  it.each([
    ['a server error', apiError(500)],
    ['a network error', new AxiosError('Network Error', 'ERR_NETWORK')],
    ['any other error', new Error('boom')],
  ])('keeps the default three retries for %s', async (_, error) => {
    expect(await attempts(error)).toBe(4)
  })

  it('stops after three failures', () => {
    const retry = retryUnlessStatus(404)
    expect(retry(2, apiError(500))).toBe(true)
    expect(retry(3, apiError(500))).toBe(false)
  })
})
