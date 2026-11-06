import type { RefObject } from 'react'
import { ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Floats over the visualizer, which fills the viewport and hides the logs. */
export function ScrollToLogsButton({
  logsRef,
}: {
  logsRef: RefObject<HTMLElement | null>
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      // Beside the board, this spot is the only free one: the visualizer keeps
      // its controls along the top, the second team's name at the bottom right,
      // and a 7rem corner button at the bottom left that grows on hover.
      className="absolute bottom-4 left-32 rounded-full shadow-lg"
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
