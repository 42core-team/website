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

installRefreshInterceptor(axiosInstance, {
  onRefreshFailed: () => {
    sessionExpiredListeners.forEach((listener) => listener())
  },
})

export default axiosInstance
