import axios, { AxiosError } from 'axios'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { installRefreshInterceptor } from './refresh-interceptor'

type Handler = (config: InternalAxiosRequestConfig) => number | Promise<number>

function createClient(handler: Handler) {
  const calls: Array<{ method?: string; url?: string }> = []
  const adapter: AxiosAdapter = async (config) => {
    calls.push({ method: config.method, url: config.url })
    const status = await handler(config)
    const response = {
      data: { url: config.url },
      status,
      statusText: String(status),
      headers: {},
      config,
    }
    if (status >= 400) {
      throw new AxiosError(
        `Request failed with status code ${status}`,
        AxiosError.ERR_BAD_REQUEST,
        config,
        null,
        response,
      )
    }
    return response
  }
  const instance = axios.create({ baseURL: 'http://api.test', adapter })
  const onRefreshFailed = vi.fn()
  installRefreshInterceptor(instance, { onRefreshFailed })
  const refreshCalls = () =>
    calls.filter((call) => call.url === '/auth/refresh').length
  return { instance, calls, refreshCalls, onRefreshFailed }
}

describe('installRefreshInterceptor', () => {
  it('refreshes on 401 and retries the original request once', async () => {
    let loggedIn = false
    const { instance, calls } = createClient((config) => {
      if (config.url === '/auth/refresh') {
        loggedIn = true
        return 204
      }
      return loggedIn ? 200 : 401
    })

    const response = await instance.get('/teams')

    expect(response.status).toBe(200)
    expect(calls).toEqual([
      { method: 'get', url: '/teams' },
      { method: 'post', url: '/auth/refresh' },
      { method: 'get', url: '/teams' },
    ])
  })

  it('retries only once when the retried request is still 401', async () => {
    const { instance, calls } = createClient((config) =>
      config.url === '/auth/refresh' ? 204 : 401,
    )

    await expect(instance.get('/teams')).rejects.toMatchObject({
      response: { status: 401 },
    })
    expect(calls).toEqual([
      { method: 'get', url: '/teams' },
      { method: 'post', url: '/auth/refresh' },
      { method: 'get', url: '/teams' },
    ])
  })

  it.each(['/auth/logout', '/auth/refresh', '/auth/refresh?x=1'])(
    'does not refresh on a 401 from %s',
    async (url) => {
      const { instance, calls } = createClient(() => 401)

      await expect(instance.post(url)).rejects.toMatchObject({
        response: { status: 401 },
      })
      expect(calls).toEqual([{ method: 'post', url }])
    },
  )

  it('does refresh on a 401 from /auth/me', async () => {
    const { instance, refreshCalls } = createClient((config) =>
      config.url === '/auth/refresh' ? 204 : 401,
    )

    await expect(instance.get('/auth/me')).rejects.toBeDefined()
    expect(refreshCalls()).toBe(1)
  })

  it('rejects with the original error and reports when the refresh fails', async () => {
    const { instance, calls, onRefreshFailed } = createClient(() => 401)

    const error = await instance.get('/auth/me').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(AxiosError)
    expect((error as AxiosError).config?.url).toBe('/auth/me')
    expect(onRefreshFailed).toHaveBeenCalledTimes(1)
    expect(calls).toEqual([
      { method: 'get', url: '/auth/me' },
      { method: 'post', url: '/auth/refresh' },
    ])
  })

  it('does not report the session as over when the refresh errors with a non-401', async () => {
    const { instance, onRefreshFailed } = createClient((config) =>
      config.url === '/auth/refresh' ? 502 : 401,
    )

    await expect(instance.get('/auth/me')).rejects.toMatchObject({
      response: { status: 401 },
    })
    expect(onRefreshFailed).not.toHaveBeenCalled()
  })

  it('does not report a failure when the refresh succeeds', async () => {
    let loggedIn = false
    const { instance, onRefreshFailed } = createClient((config) => {
      if (config.url === '/auth/refresh') {
        loggedIn = true
        return 204
      }
      return loggedIn ? 200 : 401
    })

    await instance.get('/teams')

    expect(onRefreshFailed).not.toHaveBeenCalled()
  })

  it('shares one in-flight refresh between concurrent 401s', async () => {
    let loggedIn = false
    let finishRefresh!: () => void
    const refreshGate = new Promise<void>((resolve) => {
      finishRefresh = resolve
    })
    const { instance, refreshCalls } = createClient(async (config) => {
      if (config.url === '/auth/refresh') {
        await refreshGate
        loggedIn = true
        return 204
      }
      return loggedIn ? 200 : 401
    })

    const requests = Promise.all([
      instance.get('/auth/me'),
      instance.get('/teams'),
      instance.get('/events'),
    ])
    await vi.waitFor(() => expect(refreshCalls()).toBe(1))
    finishRefresh()
    const responses = await requests

    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200,
    ])
    expect(refreshCalls()).toBe(1)
  })

  it('starts a new refresh after the previous one settled', async () => {
    let loggedIn = false
    const { instance, refreshCalls } = createClient((config) => {
      if (config.url === '/auth/refresh') {
        loggedIn = true
        return 204
      }
      return loggedIn ? 200 : 401
    })

    await instance.get('/teams')
    loggedIn = false
    await instance.get('/teams')

    expect(refreshCalls()).toBe(2)
  })

  it('reports a shared failed refresh once and rejects every waiter', async () => {
    const { instance, refreshCalls, onRefreshFailed } = createClient(() => 401)

    const results = await Promise.allSettled([
      instance.get('/auth/me'),
      instance.get('/teams'),
    ])

    expect(results.map((result) => result.status)).toEqual([
      'rejected',
      'rejected',
    ])
    expect(refreshCalls()).toBe(1)
    expect(onRefreshFailed).toHaveBeenCalledTimes(1)
  })

  it('does not refresh on other error statuses', async () => {
    const { instance, refreshCalls } = createClient(() => 403)

    await expect(instance.get('/teams')).rejects.toMatchObject({
      response: { status: 403 },
    })
    expect(refreshCalls()).toBe(0)
  })
})
