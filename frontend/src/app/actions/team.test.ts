import { describe, expect, it } from 'vitest'
import { mapTeamMemberResponse, mapTeamResponse } from './team'

describe('team API mappings', () => {
  it('preserves team tags', () => {
    expect(
      mapTeamResponse({
        id: 'team-1',
        name: 'Core',
        tags: ['42-berlin'],
      }).tags,
    ).toEqual(['42-berlin'])
  })

  it('defaults missing team tags to an empty array', () => {
    expect(mapTeamResponse({ id: 'team-1', name: 'Core' }).tags).toEqual([])
  })

  it('preserves member tags and finds the 42 username', () => {
    expect(
      mapTeamMemberResponse({
        id: 'user-1',
        name: 'Ada Lovelace',
        username: 'ada',
        isEventAdmin: false,
        tags: ['42-paris'],
        socialAccounts: [{ platform: '42', username: 'alovelac' }],
      }),
    ).toMatchObject({
      tags: ['42-paris'],
      intraUsername: 'alovelac',
    })
  })

  it('defaults missing member tags to an empty array', () => {
    expect(
      mapTeamMemberResponse({
        id: 'user-1',
        name: 'Ada Lovelace',
        username: 'ada',
        isEventAdmin: false,
      }).tags,
    ).toEqual([])
  })
})
