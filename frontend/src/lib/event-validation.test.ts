import { describe, expect, it } from 'vitest'
import { EVENT_NAME_MAX_LENGTH, getEventNameError } from './event-validation'

describe('getEventNameError', () => {
  it('leaves room for the team name and id in a 100 character repo name', () => {
    expect(EVENT_NAME_MAX_LENGTH).toBe(32)
    const repoName = `${'e'.repeat(EVENT_NAME_MAX_LENGTH)}-${'t'.repeat(30)}-${crypto.randomUUID()}`
    expect(repoName).toHaveLength(100)
  })

  it('accepts names up to the limit', () => {
    expect(getEventNameError('CORE Game 2026')).toBeUndefined()
    expect(getEventNameError('a'.repeat(EVENT_NAME_MAX_LENGTH))).toBeUndefined()
  })

  it('rejects longer names', () => {
    expect(getEventNameError('a'.repeat(EVENT_NAME_MAX_LENGTH + 1))).toMatch(
      /at most 32 characters/,
    )
  })

  it('requires a name', () => {
    expect(getEventNameError('')).toBe('Event name is required')
    expect(getEventNameError('   ')).toBe('Event name is required')
  })
})
