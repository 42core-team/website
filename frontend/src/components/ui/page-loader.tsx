import { Spinner } from '@/components/ui/spinner'

export function PageLoader() {
  return (
    <div className="page-frame page-state">
      <Spinner size="lg" />
    </div>
  )
}
