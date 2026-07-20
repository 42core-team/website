import type { GamblingSnapshot } from '@/app/actions/gambling'
import { Coins, DoorOpen, ListPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/8bit/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/8bit/card'
import { Spinner } from '@/components/ui/8bit/spinner'
import { cn } from '@/lib/utils'
import { formatGamblingCredits } from './gambling-utils'

interface GamblingSidebarProps {
  entries: GamblingSnapshot['entries']
  myTeam: GamblingSnapshot['myTeam']
  isMembershipPending: boolean
  onToggleMembership: (isEntered: boolean) => void
}

export default function GamblingSidebar({
  entries,
  myTeam,
  isMembershipPending,
  onToggleMembership,
}: GamblingSidebarProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Coins className="size-4" />
            Your team
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myTeam ? (
            <div className="space-y-4">
              <div>
                <p className="font-semibold">{myTeam.name}</p>
                <p
                  className={cn(
                    'text-2xl font-bold',
                    myTeam.credits < 0 && 'text-destructive',
                  )}
                >
                  {formatGamblingCredits(myTeam.credits)} credits
                </p>
              </div>
              <Button
                className="w-full"
                variant={myTeam.isEntered ? 'outline' : 'default'}
                disabled={isMembershipPending}
                onClick={() => onToggleMembership(myTeam.isEntered)}
              >
                {isMembershipPending ? (
                  <Spinner />
                ) : myTeam.isEntered ? (
                  <DoorOpen />
                ) : (
                  <ListPlus />
                )}
                {myTeam.isEntered ? 'Leave team list' : 'Join team list'}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Create or join an event team to enter the list and place bets.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="size-4" />
            Team list
          </CardTitle>
          <CardDescription>
            {entries.length} participating teams
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No teams have joined yet.
            </p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {entries.map((team, index) => (
                <li
                  key={team.id}
                  className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="w-6 text-right text-xs text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="font-medium">{team.name}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
