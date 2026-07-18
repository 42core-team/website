import type { TeamMember } from '@/app/actions/team'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from '@/lib/router-hooks'
import TeamMemberDisplay from './TeamMemberDisplay'

interface TeamPublicProfileProps {
  members: TeamMember[]
}

export default function TeamPublicProfile({
  members,
}: Readonly<TeamPublicProfileProps>) {
  const router = useRouter()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.back()}
          aria-label="Go back"
        >
          <ArrowLeft />
        </Button>
        <CardTitle className="flex h-9 items-center">Members</CardTitle>
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
