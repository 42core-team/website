import type { ComponentProps } from 'react'
import { PageLayout } from '@/layouts/page-layout'
import { Spinner } from '@/components/ui/spinner'

export function PageLoader({
  frame,
}: Pick<ComponentProps<typeof PageLayout>, 'frame'> = {}) {
  return (
    <PageLayout frame={frame} centered aria-busy>
      <Spinner size="lg" />
    </PageLayout>
  )
}
