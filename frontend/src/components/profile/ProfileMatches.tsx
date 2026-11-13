import type { MatchPhase, QueueMatch } from '@/app/actions/tournament-model'
import type {
  ProfileMatch,
  ProfileMatchPhase,
  ProfileTeam,
  UserProfile,
} from '@/app/actions/profile'
import { useInfiniteQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { useState } from 'react'
import { getUserProfileMatches, profileQueryKeys } from '@/app/actions/profile'
import { MatchState } from '@/app/actions/tournament-model'
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
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const PAGE_SIZE = 25
const ALL = 'all'

// The tabs of a team's match history.
const TABS: Array<{ label: string; value: ProfileMatchPhase | typeof ALL }> = [
  { label: 'All Matches', value: ALL },
  { label: 'Match Making', value: 'QUEUE' },
  { label: 'Swiss', value: 'SWISS' },
  { label: 'Tournament', value: 'ELIMINATION' },
]

/** A profile match in the shape of a team's match history. */
function toListedMatch(
  match: ProfileMatch,
  teams: Map<string, ProfileTeam>,
): QueueMatch & { eventId: string } {
  const own = teams.get(match.teamId)
  const ownTeam = {
    id: match.teamId,
    name: own?.name ?? 'Unknown',
    picture: own?.picture,
    background: own?.background,
  }
  const opponent = match.opponent
  return {
    // Without a replay id the list shows no replay button, as on team pages.
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
}

function MatchPage({
  username,
  teams,
  phase,
  eventId,
}: {
  username: string
  teams: ProfileTeam[]
  phase?: ProfileMatchPhase
  eventId?: string
}) {
  const filters = { limit: PAGE_SIZE, phase, eventId }
  const query = useInfiniteQuery({
    queryKey: profileQueryKeys.matches(username, filters),
    queryFn: ({ pageParam }) =>
      getUserProfileMatches(username, { ...filters, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.matches.length, 0)
      return loaded < last.total ? loaded : undefined
    },
  })

  if (query.isPending)
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Spinner />
      </div>
    )
  if (query.isError)
    return (
      <div className="flex min-h-40 items-center justify-center px-4 text-center text-sm text-destructive">
        Failed to load match history.
      </div>
    )

  const byId = new Map(teams.map((team) => [team.id, team]))
  const pages = query.data.pages
  const loaded = pages.flatMap((page) => page.matches)
  const remaining = pages[pages.length - 1].total - loaded.length

  return (
    <>
      <MatchesList
        matches={loaded.map((match) => toListedMatch(match, byId))}
        isInsideCard
        emptyMessage="No matches found"
      />
      {remaining > 0 && (
        <div className="flex justify-center border-t p-4">
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage && <Spinner />}
            Show {Math.min(PAGE_SIZE, remaining)} older matches
          </Button>
        </div>
      )}
    </>
  )
}

export function ProfileMatches({ profile }: { profile: UserProfile }) {
  const [phase, setPhase] = useState<string>(ALL)
  const [eventId, setEventId] = useState<string>(ALL)

  return (
    <Card className="overflow-hidden border shadow-sm">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b bg-muted/10 px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex items-center gap-2">
          <History className="size-5 text-muted-foreground" />
          <h3 className="text-xl font-semibold text-foreground">
            Match History
          </h3>
        </div>
        {profile.teams.length > 1 && (
          <Select value={eventId} onValueChange={setEventId}>
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

      <Tabs value={phase} onValueChange={setPhase} className="w-full">
        {/* Two rows of two on phones instead of a ragged wrap. */}
        <div className="border-b px-4 py-3">
          <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-0">
            <MatchPage
              username={profile.user.username}
              teams={profile.teams}
              phase={tab.value === ALL ? undefined : tab.value}
              eventId={eventId === ALL ? undefined : eventId}
            />
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  )
}
