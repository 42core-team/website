// @vitest-environment jsdom
import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cropFrame, resizeCrop, TeamImageCrop } from './TeamImageCrop'

afterEach(cleanup)
describe('visual crop selection', () => {
  it('matches the server crop for square pictures and wide backgrounds', () => {
    expect(cropFrame(1200, 600, 1)).toEqual({ width: 50, height: 100 })
    expect(cropFrame(1600, 1200, 10 / 3)).toEqual({ width: 100, height: 40 })
    expect(cropFrame(600, 1200, 1)).toEqual({ width: 100, height: 50 })
  })
  it('supports keyboard adjustment and keeps selection inside the image', () => {
    const onChange = vi.fn()
    render(
      <TeamImageCrop
        src="test.png"
        width={1200}
        height={600}
        ratio={1}
        x={99}
        y={50}
        onChange={onChange}
      />,
    )
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'Move crop selection' }),
      { key: 'ArrowRight', shiftKey: true },
    )
    expect(onChange).toHaveBeenCalledWith(100, 50)
    expect(document.querySelector('input[type=range]')).toBeNull()
  })
  it('does not move the crop while saving', () => {
    const onChange = vi.fn()
    render(
      <TeamImageCrop
        src="test.png"
        width={1200}
        height={600}
        ratio={1}
        x={50}
        y={50}
        onChange={onChange}
        disabled
      />,
    )
    fireEvent.keyDown(
      screen.getByRole('button', { name: 'Move crop selection' }),
      { key: 'ArrowLeft' },
    )
    expect(onChange).not.toHaveBeenCalled()
  })
})

it('resizes inward with the opposite corner fixed and clamps outward drags', () => {
  const crop = resizeCrop(1000, 1000, 1, 50, 50, 1, 'bottom-right', -500, -500)
  expect(crop).toEqual({ x: 0, y: 0, scale: 0.5 })
  expect(cropFrame(1000, 1000, 1, crop.scale)).toEqual({
    width: 50,
    height: 50,
  })
  expect(
    resizeCrop(1000, 1000, 1, 0, 0, 0.5, 'bottom-right', 2000, 2000).scale,
  ).toBe(1)
  expect(
    resizeCrop(1000, 1000, 1, 0, 0, 0.5, 'bottom-right', -2000, -2000).scale,
  ).toBe(0.1)
})
it('keeps a resized background at the wide aspect ratio', () => {
  const frame = cropFrame(1600, 1200, 10 / 3, 0.5)
  expect(frame).toEqual({ width: 50, height: 20 })
})
