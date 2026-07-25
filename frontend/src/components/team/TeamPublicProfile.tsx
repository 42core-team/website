import type { Team, TeamMember } from '@/app/actions/team'
import { ArrowLeft, Music } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from '@/lib/router-hooks'
import TeamMemberDisplay from './TeamMemberDisplay'
import LocationTags from './LocationTags'

interface TeamPublicProfileProps {
  team: Team
  members: TeamMember[]
  action?: ReactNode
}

export default function TeamPublicProfile({
  team,
  members,
  action,
}: Readonly<TeamPublicProfileProps>) {
  const router = useRouter()

  return (
    <Card className="overflow-hidden">
      {team.bannerImageUrl && (
        <img
          src={team.bannerImageUrl}
          alt={`${team.name} banner`}
          className="h-40 w-full object-cover sm:h-52"
        />
      )}
      <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
            aria-label="Go back"
          >
            <ArrowLeft />
          </Button>
          {team.profileImageUrl ? (
            <img
              src={team.profileImageUrl}
              alt={`${team.name} profile`}
              className="size-16 shrink-0 rounded-full border-2 border-background object-cover shadow-sm"
            />
          ) : (
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
              {team.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="truncate">{team.name}</CardTitle>
              <LocationTags tags={team.tags} />
            </div>
            <p className="text-sm text-muted-foreground">
              {members.length} team{' '}
              {members.length === 1 ? 'member' : 'members'}
            </p>
          </div>
        </div>
        {action}
      </CardHeader>
      <CardContent className="space-y-6">
        {team.description && (
          <div>
            <h3 className="mb-2 text-lg font-semibold">About</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {team.description}
            </p>
          </div>
        )}

        {team.winningSoundUrl && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Music className="size-4" />
              <h3 className="font-semibold">Winning Sound</h3>
            </div>
            <audio
              className="w-full"
              controls
              preload="none"
              src={team.winningSoundUrl}
            />
          </div>
        )}

        <div>
          <h3 className="mb-3 text-lg font-semibold">Members</h3>
          <div className="flex flex-wrap gap-3">
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No team members found.
              </p>
            ) : (
              members.map((member) => (
                <TeamMemberDisplay key={member.id} member={member} />
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
