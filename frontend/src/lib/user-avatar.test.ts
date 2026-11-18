import { afterEach, describe, expect, it, vi } from 'vitest'
import { userAvatarSrc } from './user-avatar'

afterEach(() => vi.unstubAllEnvs())

describe('userAvatarSrc', () => {
  it('falls back to the GitHub avatar without an uploaded picture', () => {
    expect(userAvatarSrc({ profilePicture: 'https://gh/a.png' })).toBe(
      'https://gh/a.png',
    )
    expect(userAvatarSrc({ profilePicture: null, picture: null })).toBe(
      undefined,
    )
  })
  it('prefers the uploaded picture over the GitHub avatar', () => {
    vi.stubEnv('VITE_MEDIA_URL', 'https://media.example.com')
    const user = {
      profilePicture: 'https://gh/a.png',
      picture: { small: 'images/s.webp', large: 'images/l.webp' },
    }
    expect(userAvatarSrc(user)).toBe('https://media.example.com/images/s.webp')
    expect(userAvatarSrc(user, true)).toBe(
      'https://media.example.com/images/l.webp',
    )
  })
})
