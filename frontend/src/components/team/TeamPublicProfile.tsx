import type { Team, TeamMember } from '@/app/actions/team'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/8bit/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/8bit/card'
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
    <Card>
      <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
            aria-label="Go back"
          >
            <ArrowLeft />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{team.name}</CardTitle>
              <LocationTags tags={team.tags} />
            </div>
            <p className="text-sm text-muted-foreground">Team members</p>
          </div>
        </div>
        {action}
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  )
}
