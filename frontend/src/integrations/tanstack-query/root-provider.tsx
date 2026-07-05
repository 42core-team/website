import { QueryClient } from '@tanstack/react-query'

export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 5 * 60_000,
        retry: 3,
        refetchOnWindowFocus: true,
      },
    },
  })

  return {
    queryClient,
  }
}
