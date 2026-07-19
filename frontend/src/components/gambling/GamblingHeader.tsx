import type { GamblingPhase, GamblingSnapshot } from '@/app/actions/gambling'
import { Clock3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import GamblingCountdown from './GamblingCountdown'
import { formatGamblingCredits } from './gambling-utils'

const phaseCopy: Record<GamblingPhase, { label: string; description: string }> =
  {
    JOINING: {
      label: 'Team selection',
      description: 'Teams can join the list before two are drawn at random.',
    },
    BETTING: {
      label: 'Betting open',
      description: 'Back one of the selected teams before the match begins.',
    },
    PLAYING: {
      label: 'Match in progress',
      description: 'Betting is closed while the selected teams play.',
    },
    SETTLED: {
      label: 'Round settled',
      description: 'The winnings have been distributed.',
    },
  }

interface GamblingHeaderProps {
  round: GamblingSnapshot['round']
  onCountdownComplete: () => void
}

export default function GamblingHeader({
  round,
  onCountdownComplete,
}: GamblingHeaderProps) {
  const copy = phaseCopy[round.phase]

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Badge>{copy.label}</Badge>
          <span className="text-sm text-muted-foreground">
            Round pool: {formatGamblingCredits(round.totalPool)} credits
          </span>
        </div>
        <h1 className="text-3xl font-bold">Gambling</h1>
        <p className="mt-1 text-muted-foreground">{copy.description}</p>
      </div>
      <Card className="min-w-52">
        <CardContent className="flex items-center gap-3 px-5 py-4">
          <Clock3 className="size-5 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">
              {round.phase === 'JOINING'
                ? 'Team draw in'
                : round.phase === 'BETTING'
                  ? 'Match starts in'
                  : 'Current state'}
            </p>
            <p className="text-2xl font-semibold">
              <GamblingCountdown
                endsAt={round.phaseEndsAt}
                onComplete={onCountdownComplete}
              />
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
