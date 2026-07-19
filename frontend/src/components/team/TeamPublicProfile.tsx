import type { TeamMember } from '@/app/actions/team'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from '@/lib/router-hooks'
import TeamMemberDisplay from './TeamMemberDisplay'

interface TeamPublicProfileProps {
  members: TeamMember[]
  teamName: string
  action?: ReactNode
}

export default function TeamPublicProfile({
  members,
  teamName,
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
            <CardTitle>{teamName}</CardTitle>
            <p className="text-sm text-muted-foreground">Team members</p>
          </div>
        </div>
        {action}
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No team members found.
          </p>
        ) : (
          members.map((member) => (
            <TeamMemberDisplay key={member.id} member={member} />
          ))
        )}
      </CardContent>
    </Card>
  )
}
