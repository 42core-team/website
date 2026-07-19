import type { GamblingSnapshot, GamblingTeam } from '@/app/actions/gambling'
import { CircleDollarSign, Coins, Swords, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import Link from '@/components/app-link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { formatGamblingCredits } from './gambling-utils'

interface TeamChoiceProps {
  team: GamblingTeam
  pool: number
  selected: boolean
  disabled: boolean
  onSelect: () => void
}

function TeamChoice({
  team,
  pool,
  selected,
  disabled,
  onSelect,
}: TeamChoiceProps) {
  return (
    <Button
      type="button"
      variant={selected ? 'default' : 'outline'}
      className="h-auto min-h-28 w-full flex-col gap-2 p-5"
      disabled={disabled}
      onClick={onSelect}
    >
      <Swords className="size-5" />
      <span className="text-base font-semibold">{team.name}</span>
      <span
        className={cn(
          'text-xs',
          selected ? 'text-primary-foreground/80' : 'text-muted-foreground',
        )}
      >
        {formatGamblingCredits(pool)} credits backed
      </span>
    </Button>
  )
}

interface GamblingMatchCardProps {
  eventId: string
  snapshot: GamblingSnapshot
  isBetPending: boolean
  onPlaceBet: (teamId: string, credits: number) => void
}

export default function GamblingMatchCard({
  eventId,
  snapshot,
  isBetPending,
  onPlaceBet,
}: GamblingMatchCardProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const round = snapshot.round

  useEffect(() => {
    setSelectedTeamId(null)
    setAmount('')
  }, [round.id])

  const selectedTeams = [round.teamOne, round.teamTwo].filter(
    (team): team is GamblingTeam => Boolean(team),
  )
  const isPlayingTeam = selectedTeams.some(
    (team) => team.id === snapshot.myTeam?.id,
  )
  const parsedAmount = Number(amount)
  const canPlaceBet =
    round.phase === 'BETTING' &&
    Boolean(selectedTeamId) &&
    selectedTeams.some((team) => team.id === selectedTeamId) &&
    Number.isInteger(parsedAmount) &&
    parsedAmount > 0 &&
    !snapshot.myBet &&
    !isPlayingTeam

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Swords className="size-5" />
          {round.phase === 'JOINING' ? 'Next match' : 'Selected match'}
        </CardTitle>
        <CardDescription>
          {round.phase === 'JOINING'
            ? 'Two teams will be selected randomly when the timer reaches zero.'
            : 'The community credit pool is split after the match result.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {round.phase === 'JOINING' ? (
          <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed text-center">
            <Users className="mb-3 size-9 text-muted-foreground" />
            <p className="font-semibold">
              {snapshot.entries.length} teams in the list
            </p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              If fewer than two teams are available, the 30-minute team
              selection countdown restarts automatically.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            {round.teamOne && (
              <TeamChoice
                team={round.teamOne}
                pool={snapshot.pools.teamOne}
                selected={selectedTeamId === round.teamOne.id}
                disabled={
                  round.phase !== 'BETTING' ||
                  Boolean(snapshot.myBet) ||
                  isPlayingTeam
                }
                onSelect={() => setSelectedTeamId(round.teamOne?.id ?? null)}
              />
            )}
            <span className="text-center text-sm font-bold text-muted-foreground">
              VS
            </span>
            {round.teamTwo && (
              <TeamChoice
                team={round.teamTwo}
                pool={snapshot.pools.teamTwo}
                selected={selectedTeamId === round.teamTwo.id}
                disabled={
                  round.phase !== 'BETTING' ||
                  Boolean(snapshot.myBet) ||
                  isPlayingTeam
                }
                onSelect={() => setSelectedTeamId(round.teamTwo?.id ?? null)}
              />
            )}
          </div>
        )}

        {round.phase === 'BETTING' && snapshot.myTeam && (
          <div className="mt-6 space-y-3 border-t pt-5">
            {snapshot.myBet ? (
              <Alert>
                <CircleDollarSign className="size-4" />
                <AlertTitle>Bet locked in</AlertTitle>
                <AlertDescription>
                  Your team backed{' '}
                  {selectedTeams.find(
                    (team) => team.id === snapshot.myBet?.predictedWinnerId,
                  )?.name ?? 'a selected team'}{' '}
                  with {formatGamblingCredits(snapshot.myBet.amount)} credits.
                </AlertDescription>
              </Alert>
            ) : isPlayingTeam ? (
              <Alert>
                <Swords className="size-4" />
                <AlertTitle>Your team is playing</AlertTitle>
                <AlertDescription>
                  Selected teams cannot bet on their own match.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    type="number"
                    min="1"
                    max="1000000"
                    step="1"
                    inputMode="numeric"
                    placeholder="Credits to bet"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                  <Button
                    className="sm:min-w-40"
                    disabled={!canPlaceBet || isBetPending}
                    onClick={() => {
                      if (selectedTeamId)
                        onPlaceBet(selectedTeamId, parsedAmount)
                    }}
                  >
                    {isBetPending ? <Spinner /> : <Coins />}
                    Place bet
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your balance may go below zero. The winning match team
                  receives 20% of the pool; the remaining 80% is shared among
                  correct bettors in proportion to their stakes.
                </p>
              </>
            )}
          </div>
        )}

        {round.phase === 'PLAYING' && round.match && (
          <div className="mt-6 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              The result will settle this round and start a new 30-minute team
              selection window.
            </p>
            <Button variant="outline" asChild>
              <Link href={`/events/${eventId}/match/${round.match.id}`}>
                Watch match
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
