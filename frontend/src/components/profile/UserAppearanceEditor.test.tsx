// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { removeUserImage, saveUserImage } from '@/app/actions/user'
import type { ClientUser } from '@/lib/auth'
import { UserAppearanceEditor } from './UserAppearanceEditor'

vi.mock('@/app/actions/user', () => ({
  saveUserImage: vi.fn(),
  removeUserImage: vi.fn(),
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const user = {
  id: 'user',
  username: 'ada',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  profilePicture: 'https://github.com/avatar.png',
} as ClientUser

function renderEditor(
  props: Partial<Parameters<typeof UserAppearanceEditor>[0]> = {},
) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <UserAppearanceEditor user={user} {...props} />
    </QueryClientProvider>,
  )
}

describe('user appearance dialog', () => {
  it('opens from the picture edit icon and keeps file controls in the dialog', () => {
    renderEditor()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit profile picture' }),
    )
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByLabelText('Choose picture file')).toBeTruthy()
    expect(
      screen
        .getByRole('button', { name: 'Save image' })
        .hasAttribute('disabled'),
    ).toBe(true)
    // Nothing uploaded yet: there is no image to remove.
    expect(screen.queryByRole('button', { name: 'Remove image' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('offers removal once a picture is uploaded', () => {
    renderEditor({
      user: { ...user, picture: { small: 's.webp', large: 'l.webp' } },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit profile picture' }),
    )
    expect(screen.getByRole('button', { name: 'Remove image' })).toBeTruthy()
  })

  it('shows a compact cover with an add button when there is no background', () => {
    renderEditor({ kind: 'background' })
    expect(document.querySelector('img')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add background' }))
    expect(screen.getByLabelText('Choose background file')).toBeTruthy()
    expect(screen.queryByLabelText('Choose picture file')).toBeNull()
  })

  it('opens the background editor from the visible cover', () => {
    renderEditor({
      kind: 'background',
      user: { ...user, background: { large: 'large.webp' } },
    })
    expect(document.querySelector('img')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Edit background' }))
    expect(screen.getByLabelText('Choose background file')).toBeTruthy()
  })
  it('removes the uploaded image through removeUserImage', async () => {
    vi.mocked(removeUserImage).mockResolvedValue(undefined)
    renderEditor({
      user: { ...user, picture: { small: 's.webp', large: 'l.webp' } },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit profile picture' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }))
    await waitFor(() => expect(removeUserImage).toHaveBeenCalledWith('picture'))
    expect(saveUserImage).not.toHaveBeenCalled()
  })

  it('saves a chosen file through saveUserImage with its crop', async () => {
    vi.mocked(saveUserImage).mockResolvedValue({ large: 'l.webp' })
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 400
        naturalHeight = 400
        onload: (() => void) | null = null
        set src(_: string) {
          queueMicrotask(() => this.onload?.())
        }
      },
    )
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
    renderEditor({ kind: 'background' })
    fireEvent.click(screen.getByRole('button', { name: 'Add background' }))
    const file = new File(['x'], 'bg.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Choose background file'), {
      target: { files: [file] },
    })
    const save = await screen.findByRole('button', { name: 'Save image' })
    await waitFor(() => expect(save.hasAttribute('disabled')).toBe(false))
    fireEvent.click(save)
    await waitFor(() =>
      expect(saveUserImage).toHaveBeenCalledWith('background', file, 50, 50, 1),
    )
  })
})
