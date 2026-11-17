import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ImageCrop } from './ImageCrop'

export type ImageKind = 'picture' | 'background'

export function AppearanceImageEditor({
  kind,
  current,
  hasImage,
  save: saveImage,
  remove: removeImage,
  successMessage,
  busy,
  setBusy,
  onClose,
}: {
  kind: ImageKind
  /** The image being replaced, or null when none is set. */
  current: ReactNode | null
  /** Whether an image is set, which enables removing it. */
  hasImage: boolean
  save: (file: File, x: number, y: number, scale: number) => Promise<unknown>
  remove: () => Promise<unknown>
  successMessage: string
  busy: boolean
  setBusy: (busy: boolean) => void
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const instructionsId = useId()
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
      if (remove) await removeImage()
      else if (file && dimensions) await saveImage(file, x, y, scale)
      else return
      await queryClient.invalidateQueries()
      toast.success(remove ? 'Image removed' : successMessage)
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
            <ImageCrop
              src={preview}
              {...dimensions}
              ratio={kind === 'picture' ? 1 : 10 / 3}
              x={x}
              y={y}
              scale={scale}
              disabled={busy}
              instructionsId={instructionsId}
              onChange={(nextX, nextY, nextScale = scale) => {
                setScale(nextScale)
                setX(nextX)
                setY(nextY)
              }}
            />
            <p
              id={instructionsId}
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
            {current ? (
              kind === 'picture' ? (
                current
              ) : (
                <div className="w-full overflow-hidden rounded-lg">
                  {current}
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
                : current
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
        {hasImage ? (
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
