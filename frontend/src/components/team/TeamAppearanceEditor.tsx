import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Pencil, Upload } from 'lucide-react'
import { toast } from 'sonner'
import type { Team } from '@/app/actions/team'
import { removeTeamImage, saveTeamImage } from '@/app/actions/team'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { TeamCover, TeamCoverStripe, TeamPicture } from './TeamAppearance'
import { TeamImageCrop } from './TeamImageCrop'

type ImageKind = 'picture' | 'background'

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
          <ImageEditor
            key={`${team.id}-${kind}`}
            team={team}
            eventId={eventId}
            kind={kind}
            busy={busy}
            setBusy={setBusy}
            onClose={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ImageEditor({
  team,
  eventId,
  kind,
  busy,
  setBusy,
  onClose,
}: {
  team: Team
  eventId: string
  kind: ImageKind
  busy: boolean
  setBusy: (busy: boolean) => void
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [dimensions, setDimensions] = useState<{
    width: number
    height: number
  } | null>(null)
  const [x, setX] = useState(50)
  const [y, setY] = useState(50)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const image = new Image()
    let active = true
    image.onload = () => {
      if (!active) return
      if (image.naturalWidth * image.naturalHeight > 25_000_000) {
        toast.error('Choose an image under 25 megapixels')
        setFile(null)
        return
      }
      setDimensions({ width: image.naturalWidth, height: image.naturalHeight })
      setPreview(url)
    }
    image.onerror = () => {
      if (active) {
        toast.error('This image could not be opened')
        setFile(null)
      }
    }
    image.src = url
    return () => {
      active = false
      URL.revokeObjectURL(url)
    }
  }, [file])

  function chooseFile(next: File | undefined) {
    if (busy || !next) return
    if (
      next.size > 10 * 1024 * 1024 ||
      !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(
        next.type,
      )
    ) {
      toast.error('Choose a JPEG, PNG, WebP or GIF image up to 10 MB')
      return
    }
    setDimensions(null)
    setPreview('')
    setFile(next)
    setX(50)
    setY(50)
    setScale(1)
  }

  async function save(remove = false) {
    setBusy(true)
    try {
      if (remove) await removeTeamImage(eventId, kind)
      else if (file && dimensions)
        await saveTeamImage(eventId, kind, file, x, y, scale)
      else return
      await queryClient.invalidateQueries()
      toast.success(remove ? 'Image removed' : 'Team image updated')
      onClose()
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } })
        .response?.data?.message
      toast.error(message || 'Could not update the image. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <fieldset disabled={busy} className="min-w-0 space-y-4">
      <input
        ref={input}
        className="sr-only"
        tabIndex={-1}
        type="file"
        aria-label={`Choose ${kind} file`}
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(event) => {
          const next = event.target.files?.[0]
          event.target.value = ''
          chooseFile(next)
        }}
      />
      <div
        className={`relative rounded-xl ${dragging ? 'ring-2 ring-primary' : ''}`}
        onDragEnter={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return
          event.preventDefault()
          dragDepth.current += 1
          if (!busy) setDragging(true)
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return
          event.preventDefault()
          event.dataTransfer.dropEffect = busy ? 'none' : 'copy'
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (dragDepth.current === 0) setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          dragDepth.current = 0
          setDragging(false)
          chooseFile(event.dataTransfer.files[0])
        }}
      >
        {preview && dimensions ? (
          <>
            <TeamImageCrop
              src={preview}
              {...dimensions}
              ratio={kind === 'picture' ? 1 : 10 / 3}
              x={x}
              y={y}
              scale={scale}
              disabled={busy}
              onChange={(nextX, nextY, nextScale = scale) => {
                setScale(nextScale)
                setX(nextX)
                setY(nextY)
              }}
            />
            <p
              id="crop-instructions"
              className="mt-4 text-center text-sm text-muted-foreground"
            >
              Drag the corners to crop closer. Drag inside the frame to move it.
              <span className="sr-only">
                {' '}
                You can also focus the frame and use the arrow keys.
              </span>
            </p>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="flex min-h-56 w-full flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/30 p-6 transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {team[kind] ? (
              kind === 'picture' ? (
                <TeamPicture team={team} large />
              ) : (
                <div className="w-full overflow-hidden rounded-lg">
                  <TeamCover team={team} />
                </div>
              )
            ) : (
              <span className="flex size-14 items-center justify-center rounded-full bg-muted">
                <ImagePlus className="size-6 text-muted-foreground" />
              </span>
            )}
            <span className="text-sm font-medium">
              {file
                ? 'Opening image…'
                : team[kind]
                  ? 'Choose a replacement image'
                  : 'Choose an image'}
              <span className="mt-1 block text-center font-normal text-muted-foreground">
                or drag and drop here
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              JPEG, PNG, WebP or GIF · Up to 10 MB
              <span className="mt-1 block">
                GIFs stay animated · Up to 200 frames and 25 million total
                pixels
              </span>
            </span>
          </button>
        )}
        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/90 text-sm font-medium text-primary">
            Drop image here
          </div>
        )}
      </div>
      {file && (
        <div className="flex min-w-0 items-center justify-between gap-3">
          <span className="truncate text-sm text-muted-foreground">
            {file.name}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => input.current?.click()}
          >
            <Upload className="size-4" />
            Change file
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        {team[kind] ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => save(true)}
          >
            Remove image
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || !file || !dimensions}
            onClick={() => save()}
          >
            {busy ? 'Saving…' : 'Save image'}
          </Button>
        </div>
      </div>
    </fieldset>
  )
}
