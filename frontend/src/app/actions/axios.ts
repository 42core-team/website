import axios from 'axios'
import { getBackendBaseUrl } from '@/lib/env'
import { installRefreshInterceptor } from './refresh-interceptor'

const axiosInstance = axios.create({
  baseURL: getBackendBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

axiosInstance.interceptors.request.use(
  (config) => {
    config.baseURL = getBackendBaseUrl()
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

const sessionExpiredListeners = new Set<() => void>()

/**
 * Subscribe to "the refresh token was rejected", i.e. the session is over.
 * Returns an unsubscribe function.
 */
export function onSessionExpired(listener: () => void) {
  sessionExpiredListeners.add(listener)
  return () => {
    sessionExpiredListeners.delete(listener)
  }
}

let sessionProbe: () => boolean = () => false

/**
 * Tell the refresh interceptor how to check whether the user is believed to
 * be signed in, so a 404 from a private event can refresh an expired access
 * cookie. Returns a function that resets it.
 */
export function setSessionProbe(probe: () => boolean) {
  sessionProbe = probe
  return () => {
    if (sessionProbe === probe) sessionProbe = () => false
  }
}

installRefreshInterceptor(axiosInstance, {
  onRefreshFailed: () => {
    sessionExpiredListeners.forEach((listener) => listener())
  },
  hasSession: () => sessionProbe(),
})

export default axiosInstance
