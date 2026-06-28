import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { isActionError } from '@/app/actions/errors'
import { joinEvent } from '@/app/actions/event'
import { myTeamQueryKey } from '@/app/events/my-team-queries'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface EventJoinNoticeProps {
  userId: string
  startDate: string
  eventId: string
  isPrivate: boolean
  isUserRegistered: boolean
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

  const formatTimeLeft = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const pad = (n: number) => String(n).padStart(2, '0')
    const hhmmss = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    return days > 0 ? `${days}d ${hhmmss}` : hhmmss
  }

  const timeLeftMs = startsAtTime - now

  const joinEventMutation = useMutation({
    mutationFn: async () => {
      const result = await joinEvent(eventId)
      if (isActionError(result)) {
        throw new Error(result.error)
      }
      return result
    },
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

  if (!showJoinButton && !hasStarted) {
    return (
      <div className="border-primary-200 mt-5 w-full border-b bg-primary-50 pb-7 sm:mt-0 sm:pb-0">
        <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex w-full flex-wrap items-center justify-between">
            <p className="text-warning-400">
              This event has not started yet. You can start coding when the
              countdown ends.
            </p>
            <Badge variant="destructive" aria-label="Event countdown">
              Starts in {formatTimeLeft(timeLeftMs)}
            </Badge>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border-primary-200 mt-5 w-full border-b bg-primary-50 pb-7 sm:mt-0 sm:pb-0">
      <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {!hasStarted && (
            <p className="text-warning-400">
              This event has not started yet. You can join now and start coding
              when the countdown ends.
            </p>
          )}
          {hasStarted && (
            <p className="text-warning-400">
              This is a private event. Join to participate and create a team.
            </p>
          )}
          <div className="flex items-center gap-2">
            {!hasStarted && (
              <Badge variant="destructive" aria-label="Event countdown">
                Starts in {formatTimeLeft(timeLeftMs)}
              </Badge>
            )}
            <Button
              onClick={() => joinEventMutation.mutate()}
              disabled={joinEventMutation.isPending}
              size="sm"
            >
              {joinEventMutation.isPending ? 'Joining...' : 'Join Event'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
