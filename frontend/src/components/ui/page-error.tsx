import { PageLayout } from '@/layouts/page-layout'
import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

export function PageError({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <PageLayout frame="form" centered>
      <section
        className="w-full space-y-3 rounded-xl border bg-card p-6"
        role="alert"
      >
        <AlertCircle
          aria-hidden="true"
          className="mx-auto size-6 text-destructive"
        />
        <h1 className="page-title">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
        {action && <div className="pt-2">{action}</div>}
      </section>
    </PageLayout>
  )
}
