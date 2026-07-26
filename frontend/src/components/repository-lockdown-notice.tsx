import { LockKeyhole } from 'lucide-react'
import { useEffect, useState } from 'react'
import TimeBadge from '@/components/timeBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

interface RepositoryLockdownNoticeProps {
  repoLockDate?: string | null
  lockedAt?: string | null
}

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

export default function RepositoryLockdownNotice({
  repoLockDate,
  lockedAt,
}: Readonly<RepositoryLockdownNoticeProps>) {
  const lockTime = repoLockDate ? new Date(repoLockDate).getTime() : Number.NaN
  const [now, setNow] = useState(() => Date.now())
  const isScheduled = Number.isFinite(lockTime) && lockTime > now && !lockedAt

  useEffect(() => {
    if (!isScheduled) return undefined

    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [isScheduled, lockTime])

  if (!Number.isFinite(lockTime)) return null

  const remainingMs = lockTime - now
  const hasReachedLockTime = remainingMs <= 0
  const isLocked = Boolean(lockedAt)
  const countdownParts = getRepoLockCountdownParts(remainingMs)

  return (
    <div className="container mx-auto max-w-7xl px-4">
      <Alert className="border-warning-400/40 bg-warning-100/50 dark:bg-warning-900/20">
        <div className="flex items-start gap-4">
          <LockKeyhole className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <AlertTitle>
              {isLocked
                ? 'Team repositories are locked'
                : hasReachedLockTime
                  ? 'Repository lockdown time reached'
                  : 'Repository lockdown scheduled'}
            </AlertTitle>
            <AlertDescription className="mt-2 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1">
                <span>Scheduled for</span>
                <TimeBadge className="font-medium" time={repoLockDate!} />
              </div>
              {!isLocked && !hasReachedLockTime && (
                <div
                  role="timer"
                  aria-label={`Repository lockdown countdown: ${formatRepoLockCountdown(remainingMs)}`}
                  className="flex flex-wrap items-center gap-1.5"
                >
                  <span className="mr-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Locks in
                  </span>
                  {Object.entries(countdownParts).map(([label, value]) => (
                    <Badge
                      key={label}
                      variant="secondary"
                      aria-label={`${label}: ${value}`}
                      className="flex min-w-13 flex-col gap-0.5 px-2 py-1 font-normal tabular-nums"
                    >
                      <span className="font-mono text-base font-bold leading-none">
                        {value}
                      </span>
                      <span className="text-[9px] leading-none tracking-wide text-muted-foreground uppercase">
                        {label}
                      </span>
                    </Badge>
                  ))}
                </div>
              )}
            </AlertDescription>
          </div>
        </div>
      </Alert>
    </div>
  )
}
