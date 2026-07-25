import type { ComponentProps } from 'react'
import { markdownToHtml } from '@/lib/markdown-to-html'
import { cn } from '@/lib/utils'

interface MarkdownContentProps extends Omit<
  ComponentProps<'article'>,
  'children' | 'dangerouslySetInnerHTML'
> {
  content: string
}

export function MarkdownContent({
  content,
  className,
  ...props
}: MarkdownContentProps) {
  return (
    <article
      className={cn('prose max-w-none dark:prose-invert', className)}
      dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
      {...props}
    />
  )
}
