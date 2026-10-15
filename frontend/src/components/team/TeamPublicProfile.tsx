import type { Team, TeamMember } from '@/app/actions/team'
import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import TeamMemberDisplay from './TeamMemberDisplay'
import { TeamProfileHeader } from './TeamProfileHeader'

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
  return (
    <Card className="gap-0 overflow-hidden pt-0">
      <TeamProfileHeader team={team} action={action} />
      <CardContent>
        <section aria-label="Team members" className="rounded-xl border p-4">
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
        </section>
      </CardContent>
    </Card>
  )
}
