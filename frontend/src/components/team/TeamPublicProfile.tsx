import type { TeamMember } from '@/app/actions/team'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TeamPublicProfileProps {
  members: TeamMember[]
}

export default function TeamPublicProfile({
  members,
}: Readonly<TeamPublicProfileProps>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No team members found.
          </p>
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              className="flex min-w-48 items-center gap-3 rounded-md border px-3 py-2"
            >
              <Avatar>
                <AvatarImage src={member.profilePicture} alt={member.name} />
                <AvatarFallback>
                  {member.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-medium">{member.username}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {member.name}
                  {member.intraUsername && (
                    <span className="ml-1 text-xs text-muted-foreground/80">
                      ({member.intraUsername})
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
