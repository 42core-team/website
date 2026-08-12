import type { TeamMember } from '@/app/actions/team'
import Image from '@/components/app-image'
import { GithubIcon } from '@/components/icons'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { ExternalLink } from 'lucide-react'
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
    <article className="w-full min-w-0 rounded-lg border p-3 sm:w-64">
      <div className="flex items-center gap-2.5 border-b pb-3">
        <Avatar
          className={cn(
            'size-10 shrink-0',
            highlightAdmin &&
              member.isEventAdmin &&
              'outline-2 outline-solid outline-orange-500',
          )}
        >
          <AvatarImage src={member.profilePicture} alt={member.name} />
          <AvatarFallback>
            {member.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{member.name}</p>
          <LocationTags tags={member.tags} className="mt-1" />
        </div>
      </div>

      <div className="mt-1.5 grid" aria-label={`${member.name}'s accounts`}>
        <a
          href={getGithubProfileUrl(member.username)}
          target="_blank"
          rel="noopener noreferrer"
          className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)_0.875rem] items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          aria-label={`Open ${member.username}'s GitHub profile`}
        >
          <span className="flex size-6 items-center justify-center rounded bg-muted text-foreground">
            <GithubIcon size={14} />
          </span>
          <span className="min-w-0">
            <span className="block text-[0.625rem] font-semibold tracking-wider text-muted-foreground uppercase">
              GitHub
            </span>
            <span className="block truncate text-sm font-medium">
              {member.username}
            </span>
          </span>
          <ExternalLink
            className="size-3 text-muted-foreground"
            aria-hidden="true"
          />
        </a>

        {member.intraUsername && (
          <a
            href={getIntraProfileUrl(member.intraUsername)}
            target="_blank"
            rel="noopener noreferrer"
            className="grid min-w-0 grid-cols-[1.5rem_minmax(0,1fr)_0.875rem] items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            aria-label={`Open ${member.intraUsername}'s 42 intra profile`}
          >
            <span className="flex size-6 items-center justify-center rounded bg-muted">
              <Image
                src="/42-logo.svg"
                alt=""
                width={14}
                height={14}
                className="size-3.5 invert dark:invert-0"
              />
            </span>
            <span className="min-w-0">
              <span className="block text-[0.625rem] font-semibold tracking-wider text-muted-foreground uppercase">
                Intra
              </span>
              <span className="block truncate text-sm font-medium">
                {member.intraUsername}
              </span>
            </span>
            <ExternalLink
              className="size-3 text-muted-foreground"
              aria-hidden="true"
            />
          </a>
        )}
      </div>
    </article>
  )
}
