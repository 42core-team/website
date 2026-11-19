import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const frameClasses = {
  standard: 'page-frame',
  form: 'page-frame page-form',
  reading: 'page-frame page-reading',
  workspace: 'page-frame page-workspace',
  full: '',
}

type PageLayoutProps = Omit<ComponentProps<'main'>, 'id' | 'tabIndex'> & {
  frame?: keyof typeof frameClasses
  centered?: boolean
}

export function PageLayout({
  frame = 'standard',
  centered = false,
  className,
  ...props
}: PageLayoutProps) {
  return (
    <main
      {...props}
      id="main-content"
      tabIndex={-1}
      className={cn(
        frameClasses[frame],
        centered ? 'page-state' : frame !== 'full' && 'page-content',
        'min-w-0 scroll-mt-(--page-scroll-offset)',
        className,
      )}
    />
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-[1_1_24rem] space-y-2">
        <h1 className="page-title">{title}</h1>
        {description && (
          <div className="max-w-[72ch] text-muted-foreground">
            {description}
          </div>
        )}
      </div>
      {actions && (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  )
}
