import type { RepositoryState } from '@/app/actions/team'

// Own actions invalidate their queries, so polling only has to catch changes
// made by other people or by server jobs.
export const QUERY_STALE_TIME_MS = 15_000

export const EVENT_REFETCH_INTERVAL_MS = 30_000
export const EVENTS_LIST_REFETCH_INTERVAL_MS = 60_000
export const GLOBAL_STATS_REFETCH_INTERVAL_MS = 30_000

export const TEAMS_REFETCH_INTERVAL_MS = 30_000
export const REPOSITORY_IDLE_REFETCH_INTERVAL_MS = 30_000
export const REPOSITORY_CHANGING_REFETCH_INTERVAL_MS = 5000

export const QUEUE_SUMMARY_REFETCH_INTERVAL_MS = 30_000
export const QUEUE_MATCHES_IDLE_REFETCH_INTERVAL_MS = 15_000
export const QUEUE_MATCHES_RUNNING_REFETCH_INTERVAL_MS = 5000
export const ADMIN_MATCHES_RUNNING_REFETCH_INTERVAL_MS = 10_000

// The server advances gambling rounds every 10 seconds.
export const GAMBLING_REFETCH_INTERVAL_MS = 10_000

const CHANGING_REPOSITORY_STATUSES: RepositoryState['repositoryStatus'][] = [
  'PROVISIONING',
  'LOCKING',
  'UNLOCKING',
]

/** Poll quickly only while GitHub is still applying a repository change. */
export function repositoryRefetchInterval(
  repositories: RepositoryState[] | undefined,
) {
  return repositories?.some((repository) =>
    CHANGING_REPOSITORY_STATUSES.includes(repository.repositoryStatus),
  )
    ? REPOSITORY_CHANGING_REFETCH_INTERVAL_MS
    : REPOSITORY_IDLE_REFETCH_INTERVAL_MS
}
