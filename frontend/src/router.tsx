import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { PageError } from '@/components/ui/page-error'
import { PageLoader } from '@/components/ui/page-loader'
import { routeTree } from './routeTree.gen'

import { getContext } from './integrations/tanstack-query/root-provider'

export function getRouter() {
  const context = getContext()

  const router = createTanStackRouter({
    routeTree,
    context,
    defaultPendingComponent: PageLoader,
    defaultErrorComponent: () => (
      <PageError
        title="Could not load this page"
        description="Something went wrong while opening this page."
        action={
          <Button onClick={() => window.location.reload()}>Try again</Button>
        }
      />
    ),
    scrollRestoration: true,
    scrollToTopSelectors: ['.main-wiki-content'],
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
