import { useState } from 'react'
import { ImagePlus, Pencil } from 'lucide-react'
import type { ProfileUser } from '@/app/actions/profile'
import { removeUserImage, saveUserImage } from '@/app/actions/user'
import { AppearanceImageEditor } from '@/components/media/AppearanceImageEditor'
import type { ImageKind } from '@/components/media/AppearanceImageEditor'
import { TeamCover } from '@/components/team/TeamAppearance'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { UserPicture } from './UserPicture'

type AppearanceUser = Pick<
  ProfileUser,
  'id' | 'name' | 'username' | 'profilePicture' | 'picture' | 'background'
>

const backgroundButtonClass =
  'flex items-center gap-2 rounded-lg border border-white/20 bg-black/65 px-3 py-2 text-sm font-medium text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

function Trigger({
  user,
  kind,
  coverHasImage,
}: {
  user: AppearanceUser
  kind: ImageKind
  coverHasImage: boolean
}) {
  if (kind === 'picture') {
    return (
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Edit profile picture"
          title="Edit profile picture"
          className="group relative block rounded-xl outline-none transition-shadow hover:ring-2 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <UserPicture user={user} />
          <span className="pointer-events-none absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm">
            <Pencil className="size-3.5" />
          </span>
        </button>
      </DialogTrigger>
    )
  }
  const verb = user.background ? 'Edit' : 'Add'
  const label = `${verb} background`
  const Icon = user.background ? Pencil : ImagePlus
  return (
    <DialogTrigger asChild>
      <button
        type="button"
        title={`${verb} profile background`}
        className={`absolute right-3 z-20 ${coverHasImage ? 'bottom-3' : 'top-1/2 -translate-y-1/2'} ${backgroundButtonClass}`}
      >
        <Icon className="size-3.5" /> {label}
      </button>
    </DialogTrigger>
  )
}

/** Lets the signed-in user replace their profile picture or background. */
export function UserAppearanceEditor({
  user,
  kind = 'picture',
  coverHasImage = Boolean(user.background),
}: {
  user: AppearanceUser
  kind?: ImageKind
  coverHasImage?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const uploaded = kind === 'picture' ? user.picture : user.background
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return
        setOpen(next)
      }}
    >
      <Trigger user={user} kind={kind} coverHasImage={coverHasImage} />
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl p-5 sm:p-6">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle>
            {kind === 'picture'
              ? 'Edit profile picture'
              : 'Edit profile background'}
          </DialogTitle>
          <DialogDescription>
            {kind === 'picture'
              ? 'Without an uploaded picture, your GitHub avatar is shown.'
              : 'Shown at the top of your public profile.'}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <AppearanceImageEditor
            key={`${user.id}-${kind}`}
            kind={kind}
            hasImage={Boolean(uploaded)}
            current={
              uploaded &&
              (kind === 'picture' ? (
                <UserPicture user={user} />
              ) : (
                <TeamCover team={user} />
              ))
            }
            save={(file, x, y, scale) => saveUserImage(kind, file, x, y, scale)}
            remove={() => removeUserImage(kind)}
            successMessage="Profile image updated"
            busy={busy}
            setBusy={setBusy}
            onClose={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
