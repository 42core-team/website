import { useEffect, useRef, useState } from 'react'

interface GamblingCountdownProps {
  endsAt: string | null
  onComplete?: () => void
}

export default function GamblingCountdown({
  endsAt,
  onComplete,
}: GamblingCountdownProps) {
  const [now, setNow] = useState(() => Date.now())
  const onCompleteRef = useRef(onComplete)
  const completedEndsAtRef = useRef<string | null>(null)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    const updateCountdown = () => {
      const nextNow = Date.now()
      setNow(nextNow)
      if (
        endsAt &&
        nextNow >= new Date(endsAt).getTime() &&
        completedEndsAtRef.current !== endsAt
      ) {
        completedEndsAtRef.current = endsAt
        onCompleteRef.current?.()
      }
    }

    updateCountdown()
    const interval = window.setInterval(updateCountdown, 1000)
    return () => window.clearInterval(interval)
  }, [endsAt])

  if (!endsAt) return <span>Match running</span>

  const remaining = Math.max(0, new Date(endsAt).getTime() - now)
  const totalSeconds = Math.ceil(remaining / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return (
    <span className="font-mono tabular-nums">
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </span>
  )
}
