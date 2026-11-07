import { describe, expect, it } from 'vitest'
import {
  REPOSITORY_CHANGING_REFETCH_INTERVAL_MS,
  REPOSITORY_IDLE_REFETCH_INTERVAL_MS,
  repositoryRefetchInterval,
} from './query-intervals'

describe('repositoryRefetchInterval', () => {
  it('polls slowly before any data has loaded', () => {
    expect(repositoryRefetchInterval(undefined)).toBe(
      REPOSITORY_IDLE_REFETCH_INTERVAL_MS,
    )
  })

  it.each(['PENDING', 'READY', 'LOCKED', 'FAILED'] as const)(
    'polls slowly when repositories are %s',
    (repositoryStatus) => {
      expect(repositoryRefetchInterval([{ repositoryStatus }])).toBe(
        REPOSITORY_IDLE_REFETCH_INTERVAL_MS,
      )
    },
  )

  it.each(['PROVISIONING', 'LOCKING', 'UNLOCKING'] as const)(
    'polls quickly when any repository is %s',
    (repositoryStatus) => {
      expect(
        repositoryRefetchInterval([
          { repositoryStatus: 'READY' },
          { repositoryStatus },
        ]),
      ).toBe(REPOSITORY_CHANGING_REFETCH_INTERVAL_MS)
    },
  )
})
