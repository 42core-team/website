import type { ReactNode } from 'react'
import type { Team } from '@/app/actions/team'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from '@/lib/router-hooks'
import { TeamCover, TeamCoverStripe, TeamPicture } from './TeamAppearance'
import LocationTags from './LocationTags'

/** Shared identity layout for a team's public profile and management page. */
export function TeamProfileHeader({
  team,
  cover,
  picture,
  action,
  badge,
  showBack = true,
}: {
  team: Team
  cover?: ReactNode
  picture?: ReactNode
  action?: ReactNode
  badge?: ReactNode
  showBack?: boolean
}) {
  const router = useRouter()
  // Without a background the cover area uses a gradient of the site's neutral colors.
  const coverContent = cover ?? (team.background ? <TeamCover team={team} /> : null)
  return (
    <>
      {coverContent ? (
        <div className="relative">
          {coverContent}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/20" />
          {showBack && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              aria-label="Go back"
              className="absolute top-4 left-4 z-20 border-white/20 bg-black/50 text-white backdrop-blur-md hover:bg-black/70 hover:text-white"
            >
              <ArrowLeft /> Back
            </Button>
          )}
        </div>
      ) : (
        <TeamCoverStripe className="items-start justify-start px-4 pt-4">
          {showBack && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              aria-label="Go back"
              className="border-white/20 bg-black/50 text-white backdrop-blur-md hover:bg-black/70 hover:text-white"
            >
              <ArrowLeft /> Back
            </Button>
          )}
        </TeamCoverStripe>
      )}
      <CardHeader className="pointer-events-none relative -mt-2 flex flex-col gap-4 space-y-0 pb-4 pt-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="pointer-events-auto shrink-0 rounded-2xl bg-card p-1 shadow-sm">
            {picture ?? <TeamPicture team={team} large />}
          </div>
          <div className="pointer-events-auto flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
            <CardTitle className="break-words text-2xl font-bold sm:text-3xl">
              {team.name}
            </CardTitle>
            {(team.tags.length > 0 || badge) && (
              <div className="flex flex-wrap items-center gap-2">
                <LocationTags tags={team.tags} />
                {badge}
              </div>
            )}
          </div>
        </div>
        {action && <div className="pointer-events-auto shrink-0">{action}</div>}
      </CardHeader>
    </>
  )
}
