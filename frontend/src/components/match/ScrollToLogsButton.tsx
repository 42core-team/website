import type { RefObject } from 'react'
import { ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Points to the logs, which the viewport-filling visualizer pushes out of view. */
export function ScrollToLogsButton({
  logsRef,
}: {
  logsRef: RefObject<HTMLElement | null>
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      onClick={() => {
        const logs = logsRef.current
        if (!logs) return
        // Keyboard users continue from the logs, not from the button.
        logs.focus({ preventScroll: true })
        logs.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
            .matches
            ? 'auto'
            : 'smooth',
        })
      }}
    >
      Logs
      <ArrowDown />
    </Button>
  )
}
