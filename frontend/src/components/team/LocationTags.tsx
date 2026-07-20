import { Badge } from '@/components/ui/themed'
import { cn } from '@/lib/utils'

interface LocationTagsProps {
  tags: string[]
  className?: string
}

export default function LocationTags({
  tags,
  className,
}: Readonly<LocationTagsProps>) {
  if (tags.length === 0) return null

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary">
          {tag}
        </Badge>
      ))}
    </div>
  )
}
