import { isAxiosError } from 'axios'

// Matches the default `retry: 3` of the app's query client.
const MAX_RETRIES = 3

/**
 * Query `retry` option that keeps the default retries but gives up at once
 * when the API answers with one of the given HTTP statuses.
 */
export function retryUnlessStatus(...statuses: number[]) {
  return (failureCount: number, error: unknown) =>
    !(
      isAxiosError(error) &&
      error.response !== undefined &&
      statuses.includes(error.response.status)
    ) && failureCount < MAX_RETRIES
}
