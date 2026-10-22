import { isAxiosError } from 'axios'
import type { AxiosInstance } from 'axios'

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    /** Set on the one retry after a refresh, so a second 401 never loops. */
    _retriedAfterRefresh?: boolean
  }
}

const REFRESH_URL = '/auth/refresh'

/**
 * Auth endpoints whose 401 must not trigger a refresh. Add any new auth
 * endpoint here that must not refresh (see ADR 0002).
 */
const EXCLUDED_PATHS = [REFRESH_URL, '/auth/logout']

function isExcluded(url: string | undefined) {
  const path = (url ?? '').split(/[?#]/)[0]
  return EXCLUDED_PATHS.some((excluded) => path.endsWith(excluded))
}

export interface RefreshInterceptorOptions {
  /**
   * Called once per refresh the server rejected (401), e.g. to mark the
   * session as logged out. Network errors and 5xx do not end the session.
   */
  onRefreshFailed?: () => void
}

/**
 * On a 401, exchange the refresh cookie for a new access token via
 * `POST /auth/refresh` and retry the original request once. Concurrent 401s
 * share one in-flight refresh. If the refresh fails, the original error is
 * rethrown. See ADR 0002, decision 11.
 */
export function installRefreshInterceptor(
  instance: AxiosInstance,
  { onRefreshFailed }: RefreshInterceptorOptions = {},
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

  return instance.interceptors.response.use(undefined, async (error) => {
    const config = isAxiosError(error) ? error.config : undefined
    if (
      !config ||
      !isAxiosError(error) ||
      error.response?.status !== 401 ||
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
