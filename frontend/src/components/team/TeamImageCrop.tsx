import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value))
type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
const corners: Corner[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
]

export function cropFrame(
  width: number,
  height: number,
  ratio: number,
  scale = 1,
) {
  const cropWidth = Math.max(
    1,
    Math.floor(Math.min(width, Math.floor(height * ratio)) * scale),
  )
  const cropHeight = Math.min(height, Math.floor(cropWidth / ratio))
  return {
    width: (cropWidth / width) * 100,
    height: (cropHeight / height) * 100,
  }
}

/** Resize against the opposite corner, preserving the aspect ratio and image bounds. */
export function resizeCrop(
  width: number,
  height: number,
  ratio: number,
  x: number,
  y: number,
  scale: number,
  corner: Corner,
  dx: number,
  dy: number,
) {
  const base = cropFrame(width, height, ratio)
  const frame = cropFrame(width, height, ratio, scale)
  const bw = (width * base.width) / 100,
    bh = (height * base.height) / 100
  const cw = (width * frame.width) / 100,
    ch = (height * frame.height) / 100
  const left = ((width - cw) * x) / 100,
    top = ((height - ch) * y) / 100
  const right = corner.endsWith('right'),
    bottom = corner.startsWith('bottom')
  const anchorX = right ? left : left + cw,
    anchorY = bottom ? top : top + ch
  const delta =
    ((right ? dx : -dx) * bw + (bottom ? dy : -dy) * bh) / (bw * bw + bh * bh)
  const max = Math.min(
    1,
    (right ? width - anchorX : anchorX) / bw,
    (bottom ? height - anchorY : anchorY) / bh,
  )
  const nextScale = clamp(scale + delta, 0.1, Math.max(0.1, max))
  const next = cropFrame(width, height, ratio, nextScale)
  const nw = (width * next.width) / 100,
    nh = (height * next.height) / 100
  return {
    x:
      width > nw
        ? clamp(((right ? anchorX : anchorX - nw) / (width - nw)) * 100)
        : 50,
    y:
      height > nh
        ? clamp(((bottom ? anchorY : anchorY - nh) / (height - nh)) * 100)
        : 50,
    scale: nextScale,
  }
}

export function TeamImageCrop({
  src,
  width,
  height,
  ratio,
  x,
  y,
  scale = 1,
  onChange,
  disabled = false,
}: {
  src: string
  width: number
  height: number
  ratio: number
  x: number
  y: number
  scale?: number
  onChange: (x: number, y: number, scale?: number) => void
  disabled?: boolean
}) {
  const container = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    pointer: number
    left: number
    top: number
    x: number
    y: number
    scale: number
    corner?: Corner
  } | null>(null)
  const frame = cropFrame(width, height, ratio, scale)
  const left = ((100 - frame.width) * x) / 100,
    top = ((100 - frame.height) * y) / 100
  function start(event: ReactPointerEvent<HTMLElement>, corner?: Corner) {
    if (disabled) return
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      pointer: event.pointerId,
      left: event.clientX,
      top: event.clientY,
      x,
      y,
      scale,
      corner,
    }
  }
  function move(event: ReactPointerEvent<HTMLElement>) {
    const initial = drag.current,
      bounds = container.current?.getBoundingClientRect()
    if (disabled || !initial || initial.pointer !== event.pointerId || !bounds)
      return
    const dx = event.clientX - initial.left,
      dy = event.clientY - initial.top
    if (initial.corner) {
      const next = resizeCrop(
        width,
        height,
        ratio,
        initial.x,
        initial.y,
        initial.scale,
        initial.corner,
        (dx / bounds.width) * width,
        (dy / bounds.height) * height,
      )
      onChange(next.x, next.y, next.scale)
    } else {
      const travelX = bounds.width * (1 - frame.width / 100),
        travelY = bounds.height * (1 - frame.height / 100)
      onChange(
        travelX > 0 ? clamp(initial.x + (dx / travelX) * 100) : 50,
        travelY > 0 ? clamp(initial.y + (dy / travelY) * 100) : 50,
      )
    }
  }
  const end = () => {
    drag.current = null
  }
  return (
    <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-xl border bg-black/90 p-3 sm:p-5">
      <div
        ref={container}
        className="relative w-full overflow-hidden select-none"
        style={{
          aspectRatio: `${width} / ${height}`,
          maxWidth: `${(320 * width) / height}px`,
        }}
      >
        <img
          src={src}
          alt="Full image with selected crop"
          draggable={false}
          className="block size-full"
        />
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label="Move crop selection"
          aria-describedby="crop-instructions"
          className="absolute touch-none cursor-grab border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] outline-none focus-visible:border-primary active:cursor-grabbing"
          style={{
            width: `${frame.width}%`,
            height: `${frame.height}%`,
            left: `${left}%`,
            top: `${top}%`,
          }}
          onPointerDown={(event) => start(event)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onLostPointerCapture={end}
          onKeyDown={(event) => {
            if (
              disabled ||
              !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
                event.key,
              )
            )
              return
            event.preventDefault()
            const step = event.shiftKey ? 10 : 2
            onChange(
              clamp(
                x +
                  (event.key === 'ArrowLeft'
                    ? -step
                    : event.key === 'ArrowRight'
                      ? step
                      : 0),
              ),
              clamp(
                y +
                  (event.key === 'ArrowUp'
                    ? -step
                    : event.key === 'ArrowDown'
                      ? step
                      : 0),
              ),
            )
          }}
        >
          <span className="pointer-events-none absolute inset-x-0 top-1/3 border-t border-white/40" />
          <span className="pointer-events-none absolute inset-x-0 top-2/3 border-t border-white/40" />
          <span className="pointer-events-none absolute inset-y-0 left-1/3 border-l border-white/40" />
          <span className="pointer-events-none absolute inset-y-0 left-2/3 border-l border-white/40" />
        </div>
        {corners.map((corner) => (
          <button
            key={corner}
            type="button"
            disabled={disabled}
            aria-label={`Resize crop from ${corner}`}
            title="Drag to resize; use arrow keys for fine adjustment"
            className={`absolute z-10 flex size-7 touch-none items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-primary ${corner === 'top-left' || corner === 'bottom-right' ? 'cursor-nwse-resize' : 'cursor-nesw-resize'}`}
            style={{
              left: `${left + (corner.endsWith('right') ? frame.width : 0)}%`,
              top: `${top + (corner.startsWith('bottom') ? frame.height : 0)}%`,
              transform: `translate(${corner.endsWith('right') ? '-100%' : '0'}, ${corner.startsWith('bottom') ? '-100%' : '0'})`,
            }}
            onPointerDown={(event) => start(event, corner)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onLostPointerCapture={end}
            onKeyDown={(event) => {
              if (
                disabled ||
                !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
                  event.key,
                )
              )
                return
              event.preventDefault()
              const step =
                Math.min(width, height) * (event.shiftKey ? 0.05 : 0.01)
              const next = resizeCrop(
                width,
                height,
                ratio,
                x,
                y,
                scale,
                corner,
                event.key === 'ArrowLeft'
                  ? -step
                  : event.key === 'ArrowRight'
                    ? step
                    : 0,
                event.key === 'ArrowUp'
                  ? -step
                  : event.key === 'ArrowDown'
                    ? step
                    : 0,
              )
              onChange(next.x, next.y, next.scale)
            }}
          >
            <span className="size-3 rounded-sm border border-black/30 bg-white shadow" />
          </button>
        ))}
      </div>
    </div>
  )
}
