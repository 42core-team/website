// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RepositoryLockdownNotice, {
  formatRepoLockCountdown,
} from '@/components/repository-lockdown-notice'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('formatRepoLockCountdown', () => {
  it('formats days and a zero-padded time', () => {
    expect(formatRepoLockCountdown(93_784_000)).toBe('1d 02:03:04')
  })

  it('never displays a negative duration', () => {
    expect(formatRepoLockCountdown(-1)).toBe('00:00:00')
  })
})

describe('RepositoryLockdownNotice', () => {
  it('renders a live countdown for a scheduled lockdown', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-26T10:00:00.000Z'))

    render(
      <RepositoryLockdownNotice
        repoLockDate="2026-07-26T11:00:00.000Z"
        lockedAt={null}
      />,
    )

    expect(screen.getByRole('timer')).toBeTruthy()
    expect(screen.getByLabelText('days: 00')).toBeTruthy()
    expect(screen.getByLabelText('hours: 01')).toBeTruthy()
    expect(screen.getByLabelText('minutes: 00')).toBeTruthy()
    expect(screen.getByLabelText('seconds: 00')).toBeTruthy()
  })

  it('ticks down every second', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-26T10:00:00.000Z'))

    render(
      <RepositoryLockdownNotice
        repoLockDate="2026-07-26T10:00:02.000Z"
        lockedAt={null}
      />,
    )

    expect(screen.getByLabelText('seconds: 02')).toBeTruthy()

    act(() => vi.advanceTimersByTime(1000))

    expect(screen.getByLabelText('seconds: 01')).toBeTruthy()
  })

  it('renders nothing when no lockdown is configured', () => {
    const { container } = render(
      <RepositoryLockdownNotice repoLockDate={null} lockedAt={null} />,
    )

    expect(container.innerHTML).toBe('')
  })

  it('shows the locked state without a countdown', () => {
    render(
      <RepositoryLockdownNotice
        repoLockDate="2026-07-26T11:00:00.000Z"
        lockedAt="2026-07-26T10:30:00.000Z"
      />,
    )

    expect(screen.getByText('Team repositories are locked')).toBeTruthy()
    expect(screen.queryByRole('timer')).toBeNull()
  })
})
