import type { MatchPhase, QueueMatch } from '@/app/actions/tournament-model'
import type { ProfileMatchPhase, UserProfile } from '@/app/actions/profile'
import { History } from 'lucide-react'
import { useMemo, useState } from 'react'
import MatchesList from '@/components/MatchesList'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MatchState } from '@/app/actions/tournament-model'

const PAGE_SIZE = 25
const ALL = 'all'

// The tabs of a team's match history.
const TABS: Array<{ label: string; value: ProfileMatchPhase | typeof ALL }> = [
  { label: 'All Matches', value: ALL },
  { label: 'Match Making', value: 'QUEUE' },
  { label: 'Swiss', value: 'SWISS' },
  { label: 'Tournament', value: 'ELIMINATION' },
]

type ListedMatch = QueueMatch & { eventId: string }

/** Every listed match in the shape of a team's match history. */
function toListedMatches(profile: UserProfile): ListedMatch[] {
  const teams = new Map(profile.teams.map((team) => [team.id, team]))
  return [...profile.matches]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .map((match) => {
      const own = teams.get(match.teamId)
      const ownTeam = {
        id: match.teamId,
        name: own?.name ?? 'Unknown',
        picture: own?.picture,
        background: own?.background,
      }
      const opponent = match.opponent
      return {
        // Unlisted replays keep the team page's behavior: no button.
        id: match.id ?? undefined,
        eventId: match.eventId,
        state: MatchState.FINISHED,
        phase: match.phase as MatchPhase,
        createdAt: match.createdAt,
        teams: opponent ? [ownTeam, opponent] : [ownTeam],
        winner:
          match.result === 'WIN'
            ? ownTeam
            : match.result === 'LOSS'
              ? opponent
              : null,
      }
    })
}

export function ProfileMatches({ profile }: { profile: UserProfile }) {
  const [phase, setPhase] = useState<string>(ALL)
  const [eventId, setEventId] = useState<string>(ALL)
  const [shown, setShown] = useState(PAGE_SIZE)

  const all = useMemo(() => toListedMatches(profile), [profile])
  const filtered = all.filter(
    (match) =>
      (eventId === ALL || match.eventId === eventId) &&
      (phase === ALL || match.phase === phase),
  )

  return (
    <Card className="overflow-hidden border shadow-sm">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b bg-muted/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <History className="size-5 text-muted-foreground" />
          <h3 className="text-xl font-semibold text-foreground">
            Match History
          </h3>
        </div>
        {profile.teams.length > 1 && (
          <Select
            value={eventId}
            onValueChange={(value) => {
              setEventId(value)
              setShown(PAGE_SIZE)
            }}
          >
            <SelectTrigger
              className="w-full sm:w-56"
              aria-label="Filter by event"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All events</SelectItem>
              {profile.teams.map((team) => (
                <SelectItem key={team.event.id} value={team.event.id}>
                  {team.event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>

      <Tabs
        value={phase}
        onValueChange={(value) => {
          setPhase(value)
          setShown(PAGE_SIZE)
        }}
        className="w-full"
      >
        <div className="border-b px-4 py-3">
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <MatchesList
        matches={filtered.slice(0, shown)}
        isInsideCard
        emptyMessage="No matches found"
      />

      {filtered.length > shown && (
        <div className="flex justify-center border-t p-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShown(shown + PAGE_SIZE)}
          >
            Show {Math.min(PAGE_SIZE, filtered.length - shown)} older matches
          </Button>
        </div>
      )}
    </Card>
  )
}
