import { QueryClient } from '@tanstack/react-query'
import { QUERY_STALE_TIME_MS } from '@/lib/query-intervals'

export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 5 * 60_000,
        staleTime: QUERY_STALE_TIME_MS,
        retry: 3,
        refetchOnWindowFocus: true,
      },
    },
  })

  return {
    queryClient,
  }
}
