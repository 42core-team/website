import type { GamblingSnapshot } from '@/app/actions/gambling'
import { History, Trophy } from 'lucide-react'
import Link from '@/components/app-link'
import { Badge } from '@/components/ui/8bit/badge'
import { Button } from '@/components/ui/8bit/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/8bit/card'
import { cn } from '@/lib/utils'
import { formatGamblingCredits } from './gambling-utils'

interface GamblingLatestResultProps {
  eventId: string
  result: GamblingSnapshot['latestResult']
}

export default function GamblingLatestResult({
  eventId,
  result,
}: GamblingLatestResultProps) {
  if (!result) return null

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="size-4" />
            Previous round
          </CardTitle>
          <CardDescription>
            {result.teamOne?.name ?? 'Unknown'} vs.{' '}
            {result.teamTwo?.name ?? 'Unknown'}
          </CardDescription>
        </div>
        {result.winner && <Badge variant="secondary">Settled</Badge>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-semibold">
            <Trophy className="size-4 text-amber-500" />
            {result.winner?.name ?? 'No winner'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatGamblingCredits(result.totalPool)} credit pool ·{' '}
            {formatGamblingCredits(result.winnerTeamPayout)} paid to the winning
            team
          </p>
          {result.myBet && (
            <p
              className={cn(
                'mt-2 text-sm font-semibold',
                result.myBet.net > 0 &&
                  'text-emerald-600 dark:text-emerald-400',
                result.myBet.net < 0 && 'text-destructive',
                result.myBet.net === 0 && 'text-muted-foreground',
              )}
            >
              {result.myBet.net > 0
                ? `Your bet won ${formatGamblingCredits(result.myBet.net)} credits`
                : result.myBet.net < 0
                  ? `Your bet lost ${formatGamblingCredits(Math.abs(result.myBet.net))} credits`
                  : 'Your bet broke even'}
              {' · '}
              {formatGamblingCredits(result.myBet.amount)} staked,{' '}
              {formatGamblingCredits(result.myBet.payout)} returned
            </p>
          )}
        </div>
        {result.matchId && (
          <Button variant="outline" asChild>
            <Link href={`/events/${eventId}/match/${result.matchId}`}>
              View match
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
