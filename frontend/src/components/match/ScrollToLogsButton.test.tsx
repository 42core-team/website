// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ScrollToLogsButton } from './ScrollToLogsButton'

function Page() {
  const logsRef = useRef<HTMLDivElement>(null)
  return (
    <>
      <ScrollToLogsButton logsRef={logsRef} />
      <div ref={logsRef} tabIndex={-1} data-testid="logs" />
    </>
  )
}

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', () => ({ matches }))
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
})

describe('scroll to logs button', () => {
  it('scrolls to the logs smoothly and moves focus there', () => {
    stubReducedMotion(false)
    render(<Page />)

    fireEvent.click(screen.getByRole('button', { name: 'Logs' }))

    const logs = screen.getByTestId('logs')
    expect(logs.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
    expect(document.activeElement).toBe(logs)
  })

  it('jumps without animating when reduced motion is preferred', () => {
    stubReducedMotion(true)
    render(<Page />)

    fireEvent.click(screen.getByRole('button', { name: 'Logs' }))

    expect(screen.getByTestId('logs').scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
    })
  })
})
