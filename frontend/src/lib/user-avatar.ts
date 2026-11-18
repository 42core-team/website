import type { TeamImage } from '@/app/actions/team'
import { mediaUrl } from '@/lib/media-url'

interface UserAvatar {
  profilePicture?: string | null
  picture?: TeamImage | null
}

/** The uploaded picture when set, otherwise the GitHub avatar. */
export function userAvatarSrc(user: UserAvatar, large = false) {
  const uploaded = user.picture
    ? mediaUrl(large ? user.picture.large : user.picture.small)
    : undefined
  return uploaded ?? user.profilePicture ?? undefined
}
