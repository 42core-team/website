import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, UserPlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { joinEvent } from '@/app/actions/event'
import { myTeamQueryKey } from '@/app/events/my-team-queries'
import { Button } from '@/components/ui/button'

interface EventJoinNoticeProps {
  userId: string
  startDate: string
  eventId: string
  isPrivate: boolean
  isUserRegistered: boolean
}

function EventStartCountdown({
  remainingMs,
}: Readonly<{ remainingMs: number }>) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  const timeParts = {
    days: pad(days),
    hours: pad(hours),
    minutes: pad(minutes),
    seconds: pad(seconds),
  }
  const formattedTime = `${days > 0 ? `${days}d ` : ''}${timeParts.hours}:${timeParts.minutes}:${timeParts.seconds}`

  return (
    <div
      role="timer"
      aria-label={`Event start countdown: ${formattedTime}`}
      className="flex items-baseline gap-1 font-mono text-lg font-semibold tracking-tight tabular-nums"
    >
      <span
        aria-label={`days: ${timeParts.days}`}
        className={days === 0 ? 'sr-only' : undefined}
      >
        {days}d
      </span>
      <span aria-label={`hours: ${timeParts.hours}`}>{timeParts.hours}</span>
      <span aria-hidden="true" className="text-muted-foreground/60">
        :
      </span>
      <span aria-label={`minutes: ${timeParts.minutes}`}>
        {timeParts.minutes}
      </span>
      <span aria-hidden="true" className="text-muted-foreground/60">
        :
      </span>
      <span aria-label={`seconds: ${timeParts.seconds}`}>
        {timeParts.seconds}
      </span>
    </div>
  )
}

export default function EventInfoNotice({
  userId: _userId,
  startDate,
  eventId,
  isPrivate,
  isUserRegistered,
}: Readonly<EventJoinNoticeProps>) {
  const queryClient = useQueryClient()
  const startsAtTime = new Date(startDate).getTime()
  const [now, setNow] = useState(() => Date.now())
  const hasStarted = startsAtTime <= now
  const didInvalidateStartRef = useRef(startsAtTime <= Date.now())

  const showJoinButton = isPrivate && !isUserRegistered

  useEffect(() => {
    if (hasStarted) return undefined

    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [hasStarted])

  useEffect(() => {
    if (!didInvalidateStartRef.current && hasStarted) {
      didInvalidateStartRef.current = true
      void queryClient.invalidateQueries({ queryKey: ['event', eventId] })
      void queryClient.invalidateQueries({
        queryKey: ['event', eventId, 'is-user-registered'],
      })
      void queryClient.invalidateQueries({ queryKey: myTeamQueryKey(eventId) })
    }
  }, [eventId, hasStarted, queryClient])

  const timeLeftMs = startsAtTime - now

  const joinEventMutation = useMutation({
    mutationFn: async () => joinEvent(eventId),
    onSuccess: () => {
      toast.success('Successfully joined the event!')
      void queryClient.invalidateQueries({ queryKey: ['event', eventId] })
      void queryClient.invalidateQueries({
        queryKey: ['event', eventId, 'is-user-registered'],
      })
      void queryClient.invalidateQueries({ queryKey: myTeamQueryKey(eventId) })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to join event')
    },
  })

  if (!showJoinButton && hasStarted) {
    return <></>
  }

  return (
    <aside
      role="status"
      className="border-y border-warning-400/25 bg-warning-50/70 dark:bg-warning-900/10"
    >
      <div className="container mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning-400/10 text-warning-700 dark:text-warning-400">
            <CalendarClock className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">
              {hasStarted ? 'Private event' : 'Event starts soon'}
            </p>
            <p className="text-xs text-muted-foreground">
              {showJoinButton
                ? hasStarted
                  ? 'Join to participate and create a team.'
                  : 'Join this private event now and start coding when the countdown ends.'
                : 'You can start coding when the countdown ends.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:border-l sm:pl-5">
          {!hasStarted && (
            <>
              <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                Starts in
              </span>
              <EventStartCountdown remainingMs={timeLeftMs} />
            </>
          )}
          {showJoinButton && (
            <div className="flex w-full border-t border-border/70 pt-3 sm:w-auto sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
              <Button
                onClick={() => joinEventMutation.mutate()}
                disabled={joinEventMutation.isPending}
                className="w-full min-w-36 font-semibold transition-transform hover:-translate-y-0.5 sm:w-auto"
              >
                <UserPlus aria-hidden="true" />
                {joinEventMutation.isPending ? 'Joining...' : 'Join Event'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
