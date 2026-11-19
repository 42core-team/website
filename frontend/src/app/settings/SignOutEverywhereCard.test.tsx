// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SignOutEverywhereCard from './SignOutEverywhereCard'

const { mutateAsync, toastError } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  useSignOutEverywhere: () => ({ mutateAsync, isPending: false }),
}))
vi.mock('sonner', () => ({ toast: { error: toastError } }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function openDialog() {
  render(<SignOutEverywhereCard />)
  fireEvent.click(screen.getByRole('button', { name: 'Log out everywhere' }))
  return screen.getByRole('dialog')
}

describe('SignOutEverywhereCard', () => {
  it('asks for confirmation before logging out everywhere', () => {
    const dialog = openDialog()

    expect(dialog.textContent).toContain('all devices')
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('logs out everywhere once confirmed', async () => {
    mutateAsync.mockResolvedValue(undefined)
    const dialog = openDialog()

    fireEvent.click(
      Array.from(dialog.querySelectorAll('button')).find(
        (button) => button.textContent === 'Log out everywhere',
      )!,
    )

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
    expect(toastError).not.toHaveBeenCalled()
  })

  it('does nothing when cancelled', async () => {
    const dialog = openDialog()

    fireEvent.click(
      Array.from(dialog.querySelectorAll('button')).find(
        (button) => button.textContent === 'Cancel',
      )!,
    )

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('shows an error when logging out everywhere fails', async () => {
    mutateAsync.mockRejectedValue(new Error('boom'))
    const dialog = openDialog()

    fireEvent.click(
      Array.from(dialog.querySelectorAll('button')).find(
        (button) => button.textContent === 'Log out everywhere',
      )!,
    )

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1))
  })
})
