import { LockKeyhole } from 'lucide-react'
import { useEffect, useState } from 'react'
import TimeBadge from '@/components/timeBadge'

interface RepositoryLockdownNoticeProps {
  repoLockDate?: string | null
  lockedAt?: string | null
  variant?: 'banner' | 'summary'
}

export const REPOSITORY_LOCKDOWN_BANNER_LEAD_TIME_MS = 3 * 60 * 60 * 1000
export const REPOSITORY_LOCKDOWN_BANNER_FOLLOW_UP_MS = 60 * 60 * 1000

export function formatRepoLockCountdown(remainingMs: number) {
  const { days, hours, minutes, seconds } =
    getRepoLockCountdownParts(remainingMs)
  const time = `${hours}:${minutes}:${seconds}`

  return days !== '00' ? `${Number(days)}d ${time}` : time
}

export function getRepoLockCountdownParts(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => String(value).padStart(2, '0')

  return {
    days: pad(days),
    hours: pad(hours),
    minutes: pad(minutes),
    seconds: pad(seconds),
  }
}

function BannerCountdown({ remainingMs }: Readonly<{ remainingMs: number }>) {
  const { days, hours, minutes, seconds } =
    getRepoLockCountdownParts(remainingMs)

  return (
    <div
      role="timer"
      aria-label={`Repository lockdown countdown: ${formatRepoLockCountdown(remainingMs)}`}
      className="flex items-baseline gap-1 font-mono text-lg font-semibold tracking-tight tabular-nums"
    >
      <span
        aria-label={`days: ${days}`}
        className={days === '00' ? 'sr-only' : undefined}
      >
        {Number(days)}d
      </span>
      <span aria-label={`hours: ${hours}`}>{hours}</span>
      <span aria-hidden="true" className="text-muted-foreground/60">
        :
      </span>
      <span aria-label={`minutes: ${minutes}`}>{minutes}</span>
      <span aria-hidden="true" className="text-muted-foreground/60">
        :
      </span>
      <span aria-label={`seconds: ${seconds}`}>{seconds}</span>
    </div>
  )
}

export default function RepositoryLockdownNotice({
  repoLockDate,
  lockedAt,
  variant = 'banner',
}: Readonly<RepositoryLockdownNoticeProps>) {
  const lockTime = repoLockDate ? new Date(repoLockDate).getTime() : Number.NaN
  const [now, setNow] = useState(() => Date.now())
  const shouldTick =
    Number.isFinite(lockTime) &&
    (lockTime > now ||
      (variant === 'banner' &&
        now <= lockTime + REPOSITORY_LOCKDOWN_BANNER_FOLLOW_UP_MS))

  useEffect(() => {
    if (!shouldTick) return undefined

    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [shouldTick, lockTime])

  if (!Number.isFinite(lockTime)) return null

  const remainingMs = lockTime - now
  const hasReachedLockTime = remainingMs <= 0
  const isLocked = Boolean(lockedAt)
  const isWithinBannerWindow =
    now >= lockTime - REPOSITORY_LOCKDOWN_BANNER_LEAD_TIME_MS &&
    now <= lockTime + REPOSITORY_LOCKDOWN_BANNER_FOLLOW_UP_MS

  if (variant === 'banner' && !isWithinBannerWindow) return null

  if (variant === 'summary') {
    return (
      <section
        aria-labelledby="repository-lockdown-heading"
        className="border-t pt-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning-400/10 text-warning-700 dark:text-warning-400">
              <LockKeyhole className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="repository-lockdown-heading"
                className="text-sm font-medium text-muted-foreground"
              >
                Repository lockdown
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
                <TimeBadge className="font-medium" time={repoLockDate!} />
              </div>
            </div>
          </div>

          <div>
            {!isLocked && !hasReachedLockTime ? (
              <div className="rounded-lg bg-muted/60 px-3 py-2 sm:text-right">
                <p className="font-mono text-sm font-semibold tracking-tight tabular-nums">
                  Locks in {formatRepoLockCountdown(remainingMs)}
                </p>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive">
                <span className="size-1.5 rounded-full bg-current" />
                {isLocked ? 'Repositories locked' : 'Lock time reached'}
              </div>
            )}
          </div>
        </div>
      </section>
    )
  }

  return (
    <aside
      role="alert"
      className="border-y border-warning-400/25 bg-warning-50/70 dark:bg-warning-900/10"
    >
      <div className="container mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning-400/10 text-warning-700 dark:text-warning-400">
            <LockKeyhole className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">
              {isLocked
                ? 'Team repositories are locked'
                : hasReachedLockTime
                  ? 'Repository lockdown time reached'
                  : 'Repository lockdown scheduled'}
            </p>
            {!isLocked && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>Scheduled for</span>
                <TimeBadge className="font-medium" time={repoLockDate!} />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 sm:border-l sm:pl-5">
          {!isLocked && !hasReachedLockTime ? (
            <>
              <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                Locks in
              </span>
              <BannerCountdown remainingMs={remainingMs} />
            </>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive">
              <span className="size-1.5 rounded-full bg-current" />
              {isLocked ? 'Locked' : 'Pending lock'}
            </span>
          )}
        </div>
      </div>
    </aside>
  )
}
