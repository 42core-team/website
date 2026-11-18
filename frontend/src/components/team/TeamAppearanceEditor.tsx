import { useState } from 'react'
import { ImagePlus, Pencil } from 'lucide-react'
import type { Team } from '@/app/actions/team'
import { removeTeamImage, saveTeamImage } from '@/app/actions/team'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { TeamCover, TeamCoverStripe, TeamPicture } from './TeamAppearance'
import { AppearanceImageEditor } from '@/components/media/AppearanceImageEditor'
import type { ImageKind } from '@/components/media/AppearanceImageEditor'

const backgroundButtonClass =
  'flex items-center gap-2 rounded-lg border border-white/20 bg-black/65 px-3 py-2 text-sm font-medium text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

/** Shows the current cover, or a compact fallback with an option to add one. */
function BackgroundTrigger({ team }: { team: Team }) {
  if (team.background) {
    return (
      <div className="relative">
        <TeamCover team={team} />
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label="Edit team background"
            title="Edit team background"
            className={`absolute right-3 bottom-3 z-20 ${backgroundButtonClass}`}
          >
            <Pencil className="size-3.5" /> Edit background
          </button>
        </DialogTrigger>
      </div>
    )
  }
  return (
    <TeamCoverStripe>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Add team background"
          title="Add team background"
          className={backgroundButtonClass}
        >
          <ImagePlus className="size-3.5" /> Add background
        </button>
      </DialogTrigger>
    </TeamCoverStripe>
  )
}

export function TeamAppearanceEditor({
  team,
  eventId,
  kind = 'picture',
}: {
  team: Team
  eventId: string
  kind?: ImageKind
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return
        setOpen(next)
      }}
    >
      {kind === 'picture' ? (
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label="Edit team picture"
            title="Edit team picture"
            className="group relative block rounded-xl outline-none transition-shadow hover:ring-2 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            <TeamPicture team={team} large />
            <span className="pointer-events-none absolute inset-0 rounded-xl bg-black/0 transition-colors group-hover:bg-black/15" />
            <span className="pointer-events-none absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm">
              <Pencil className="size-3.5" />
            </span>
          </button>
        </DialogTrigger>
      ) : (
        <BackgroundTrigger team={team} />
      )}
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl p-5 sm:p-6">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle>
            {kind === 'picture' ? 'Edit team picture' : 'Edit team background'}
          </DialogTitle>
          <DialogDescription>
            Make your team recognizable on profiles and matches.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <AppearanceImageEditor
            key={`${team.id}-${kind}`}
            kind={kind}
            hasImage={Boolean(team[kind])}
            current={
              team[kind] &&
              (kind === 'picture' ? (
                <TeamPicture team={team} large />
              ) : (
                <TeamCover team={team} />
              ))
            }
            save={(file, x, y, scale) =>
              saveTeamImage(eventId, kind, file, x, y, scale)
            }
            remove={() => removeTeamImage(eventId, kind)}
            successMessage="Team image updated"
            busy={busy}
            setBusy={setBusy}
            onClose={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
