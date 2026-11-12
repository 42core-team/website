import type { ReactNode } from 'react'
import type { TeamAppearance as Appearance } from '@/app/actions/team'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export function teamImageUrl(key: string) {
  const base = (
    import.meta.env.VITE_MEDIA_URL ||
    (import.meta.env.DEV ? 'http://localhost:9000/core-team-images' : '')
  ).replace(/\/$/, '')
  return base
    ? `${base}/${key.split('/').map(encodeURIComponent).join('/')}`
    : undefined
}
export function TeamPicture({
  team,
  large = false,
  className,
  fallbackClassName,
}: {
  team: Appearance & { name: string }
  large?: boolean
  className?: string
  fallbackClassName?: string
}) {
  return (
    <Avatar
      className={cn(
        large
          ? 'size-20 shrink-0 rounded-xl border-2 border-background'
          : 'size-8 shrink-0 rounded-md',
        className,
      )}
    >
      <AvatarImage
        src={
          team.picture
            ? teamImageUrl(large ? team.picture.large : team.picture.small)
            : undefined
        }
        alt=""
        className="object-cover"
      />
      <AvatarFallback
        className={cn(
          'rounded-md bg-primary/15 font-semibold text-foreground',
          fallbackClassName,
        )}
      >
        {team.name.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}
export function TeamCover({
  team,
  className,
}: {
  team: Appearance
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative aspect-[10/3] w-full overflow-hidden rounded-t-xl bg-gradient-to-br from-primary/25 via-muted to-primary/5',
        className,
      )}
    >
      {team.background && (
        <img
          src={teamImageUrl(team.background.large)}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </div>
  )
}

/** Compact neutral gradient cover shown when a team has no background. */
export function TeamCoverStripe({
  children,
  className,
}: {
  children?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-20 w-full items-center justify-end gap-3 rounded-t-xl bg-gradient-to-br from-background via-card to-muted px-3 sm:h-28',
        className,
      )}
    >
      {children}
    </div>
  )
}
