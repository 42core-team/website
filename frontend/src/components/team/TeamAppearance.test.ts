import { afterEach, describe, expect, it, vi } from 'vitest'
import { teamImageUrl } from './TeamAppearance'

afterEach(() => vi.unstubAllEnvs())

describe('media image URLs', () => {
  it('uses the shared media URL and encodes object keys', () => {
    vi.stubEnv('VITE_MEDIA_URL', 'https://media.example.com/')
    expect(teamImageUrl('teams/team name/picture.webp')).toBe(
      'https://media.example.com/teams/team%20name/picture.webp',
    )
  })

  it('uses the local bucket in development when no media URL is configured', () => {
    vi.stubEnv('VITE_MEDIA_URL', '')
    vi.stubEnv('DEV', true)
    expect(teamImageUrl('picture.webp')).toBe(
      'http://localhost:9000/core-team-images/picture.webp',
    )
  })

  it('does not use the local bucket in production', () => {
    vi.stubEnv('VITE_MEDIA_URL', '')
    vi.stubEnv('DEV', false)
    expect(teamImageUrl('picture.webp')).toBeUndefined()
  })
})
