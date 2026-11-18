import type { ProfileUser } from '@/app/actions/profile'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { userAvatarSrc } from '@/lib/user-avatar'

export function UserPicture({
  user,
}: {
  user: Pick<ProfileUser, 'name' | 'username' | 'picture' | 'profilePicture'>
}) {
  return (
    <Avatar className="size-20 shrink-0 rounded-xl border-2 border-background">
      <AvatarImage
        src={userAvatarSrc(user, true)}
        alt=""
        className="object-cover"
      />
      <AvatarFallback className="rounded-md bg-primary/15 text-xl font-semibold text-foreground">
        {(user.name || user.username).slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}
