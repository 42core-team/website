import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { CalendarClock, UserPlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { joinEvent } from '@/app/actions/event'
import { myTeamQueryKey } from '@/app/events/my-team-queries'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
  const navigate = useNavigate()
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
      queryClient.setQueryData(['event', eventId, 'is-user-registered'], true)
      void queryClient.invalidateQueries({ queryKey: ['events'] })
      void queryClient.invalidateQueries({ queryKey: ['event', eventId] })
      void queryClient.invalidateQueries({
        queryKey: ['event', eventId, 'is-user-registered'],
      })
      void queryClient.invalidateQueries({ queryKey: myTeamQueryKey(eventId) })
      void navigate({ to: '/events/$id/my-team', params: { id: eventId } })
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
      className={cn(
        'border-y',
        showJoinButton
          ? 'border-primary/30 bg-primary/10'
          : 'border-warning-400/25 bg-warning-50/70 dark:bg-warning-900/10',
      )}
    >
      <div
        className={cn(
          'container mx-auto flex max-w-7xl flex-col px-4',
          showJoinButton
            ? 'gap-4 py-6 md:flex-row md:items-center md:justify-between'
            : 'gap-3 py-3 sm:flex-row sm:items-center sm:justify-between',
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              'flex shrink-0 items-center justify-center rounded-lg',
              showJoinButton
                ? 'size-12 bg-primary/15 text-primary'
                : 'size-9 bg-warning-400/10 text-warning-700 dark:text-warning-400',
            )}
          >
            {showJoinButton ? (
              <UserPlus className="size-6" aria-hidden="true" />
            ) : (
              <CalendarClock className="size-4" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            {showJoinButton && (
              <p className="mb-1 text-xs font-semibold tracking-wide text-primary uppercase">
                Step 1 · Join this private event
              </p>
            )}
            <p
              className={cn(
                'font-semibold tracking-tight',
                showJoinButton ? 'text-lg' : 'text-sm',
              )}
            >
              {showJoinButton
                ? 'Want to create a team? Join the event first.'
                : 'Event starts soon'}
            </p>
            <p
              className={cn(
                'text-muted-foreground',
                showJoinButton ? 'mt-1 text-sm' : 'text-xs',
              )}
            >
              {showJoinButton
                ? 'Click Join Event to go to My Team, where you can create a team or accept an invite.'
                : 'You can start coding when the countdown ends.'}
            </p>
          </div>
        </div>

        <div
          className={cn(
            'flex shrink-0 gap-3',
            showJoinButton
              ? 'flex-col md:border-l md:pl-5 xl:flex-row xl:items-center'
              : 'flex-wrap items-center sm:border-l sm:pl-5',
          )}
        >
          {!hasStarted && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                Starts in
              </span>
              <EventStartCountdown remainingMs={timeLeftMs} />
            </div>
          )}
          {showJoinButton && (
            <div
              className={cn(
                'flex w-full xl:w-auto',
                !hasStarted &&
                  'border-t border-primary/20 pt-3 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-4',
              )}
            >
              <Button
                onClick={() => joinEventMutation.mutate()}
                disabled={joinEventMutation.isPending}
                size="lg"
                isLoading={joinEventMutation.isPending}
                className="w-full min-w-40 font-semibold shadow-lg shadow-primary/20 xl:w-auto"
              >
                {!joinEventMutation.isPending && (
                  <UserPlus aria-hidden="true" />
                )}
                {joinEventMutation.isPending ? 'Joining...' : 'Join Event'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
