import { isAxiosError } from 'axios'
import type { AxiosInstance } from 'axios'

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    /**
     * Set on the one retry after a refresh, so a second 401 or 404 never
     * loops.
     */
    _retriedAfterRefresh?: boolean
  }
}

const REFRESH_URL = '/auth/refresh'

/**
 * Auth endpoints whose 401 must not trigger a refresh. Add any new auth
 * endpoint here that must not refresh (see ADR 0002).
 */
const EXCLUDED_PATHS = [REFRESH_URL, '/auth/logout']

function getPath(url: string | undefined) {
  return (url ?? '').split(/[?#]/)[0]
}

function isExcluded(url: string | undefined) {
  const path = getPath(url)
  return EXCLUDED_PATHS.some((excluded) => path.endsWith(excluded))
}

/**
 * The API answers 404 instead of 401 for an event the caller may not see, so
 * an expired access cookie makes a private event look unknown. Those routes
 * all live under these controllers.
 */
const EVENT_SCOPED_CONTROLLERS = new Set(['event', 'team', 'match', 'gambling'])

function isEventScoped(url: string | undefined) {
  const [controller] = getPath(url).replace(/^\/+/, '').split('/')
  return EVENT_SCOPED_CONTROLLERS.has(controller)
}

export interface RefreshInterceptorOptions {
  /**
   * Called once per refresh the server rejected (401), e.g. to mark the
   * session as logged out. Network errors and 5xx do not end the session.
   */
  onRefreshFailed?: () => void
  /**
   * Whether the user is believed to be signed in. Only then does a 404 from
   * an event-scoped route refresh and retry, since the access cookie may have
   * expired. Without it, 404s are never retried.
   */
  hasSession?: () => boolean
}

/**
 * On a 401, exchange the refresh cookie for a new access token via
 * `POST /auth/refresh` and retry the original request once. A 404 from an
 * event-scoped route does the same while `hasSession` says the user is signed
 * in. Concurrent 401s and 404s share one in-flight refresh. If the refresh
 * fails, the original error is rethrown. See ADR 0002, decision 11.
 */
export function installRefreshInterceptor(
  instance: AxiosInstance,
  { onRefreshFailed, hasSession }: RefreshInterceptorOptions = {},
) {
  let inFlightRefresh: Promise<boolean> | null = null

  const refresh = () => {
    inFlightRefresh ??= instance
      .post(REFRESH_URL)
      .then(
        () => true,
        (refreshError: unknown) => {
          if (
            isAxiosError(refreshError) &&
            refreshError.response?.status === 401
          ) {
            onRefreshFailed?.()
          }
          return false
        },
      )
      .finally(() => {
        inFlightRefresh = null
      })
    return inFlightRefresh
  }

  const mayBeExpiredSession = (
    status: number | undefined,
    url: string | undefined,
  ) =>
    status === 401 ||
    (status === 404 && isEventScoped(url) && hasSession?.() === true)

  return instance.interceptors.response.use(undefined, async (error) => {
    const config = isAxiosError(error) ? error.config : undefined
    if (
      !config ||
      !isAxiosError(error) ||
      !mayBeExpiredSession(error.response?.status, config.url) ||
      config._retriedAfterRefresh ||
      isExcluded(config.url)
    ) {
      throw error
    }
    if (!(await refresh())) {
      throw error
    }
    config._retriedAfterRefresh = true
    return instance.request(config)
  })
}
