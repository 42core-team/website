import type { TeamMember } from '@/app/actions/team'
import Image from '@/components/app-image'
import { GithubIcon } from '@/components/icons'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/8bit/avatar'
import { cn } from '@/lib/utils'
import LocationTags from './LocationTags'

interface TeamMemberDisplayProps {
  member: TeamMember
  highlightAdmin?: boolean
}

function getGithubProfileUrl(username: string) {
  return `https://github.com/${username}`
}

function getIntraProfileUrl(username: string) {
  return `https://profile.intra.42.fr/users/${username}`
}

export default function TeamMemberDisplay({
  member,
  highlightAdmin = false,
}: Readonly<TeamMemberDisplayProps>) {
  return (
    <div className="flex min-w-48 items-center gap-3 rounded-md border px-3 py-2">
      <Avatar
        className={cn(
          highlightAdmin &&
            member.isEventAdmin &&
            'outline-2 outline-solid outline-orange-500',
        )}
      >
        <AvatarImage src={member.profilePicture} alt={member.name} />
        <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{member.username}</p>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={getGithubProfileUrl(member.username)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm text-muted-foreground transition hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              aria-label={`Open ${member.username}'s GitHub profile`}
            >
              <GithubIcon size={18} />
            </a>
            {member.intraUsername && (
              <a
                href={getIntraProfileUrl(member.intraUsername)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-sm opacity-70 transition hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                aria-label={`Open ${member.intraUsername}'s 42 intra profile`}
              >
                <Image
                  src="/42-logo.svg"
                  alt=""
                  width={18}
                  height={18}
                  className="size-4.5 invert dark:invert-0"
                />
              </a>
            )}
          </div>
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {member.name}
          {member.intraUsername && (
            <span className="ml-1 text-xs text-muted-foreground/80">
              ({member.intraUsername})
            </span>
          )}
        </p>
        <LocationTags tags={member.tags} className="mt-1" />
      </div>
    </div>
  )
}
