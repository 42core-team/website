// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MatchVisualizerFrame } from './MatchVisualizerFrame'

afterEach(cleanup)

describe('match visualizer frame', () => {
  it('takes focus without scrolling once loaded', () => {
    render(<MatchVisualizerFrame src="about:blank" />)
    const frame = screen.getByTitle('Match visualizer')
    const focus = vi.spyOn(frame, 'focus')

    fireEvent.load(frame)

    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(document.activeElement).toBe(frame)
  })

  it('keeps focus where the user moved it while loading', () => {
    render(
      <>
        <button type="button">Back</button>
        <MatchVisualizerFrame src="about:blank" />
      </>,
    )
    const button = screen.getByRole('button', { name: 'Back' })
    button.focus()

    fireEvent.load(screen.getByTitle('Match visualizer'))

    expect(document.activeElement).toBe(button)
  })
})
