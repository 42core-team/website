import type { Match } from '@/app/actions/tournament-model'
import { History } from 'lucide-react'
import { MatchPhase } from '@/app/actions/tournament-model'
import QueueMatchesList from '@/components/QueueMatchesList'
import { Card, CardHeader } from '@/components/ui/8bit/card'
import { Spinner } from '@/components/ui/8bit/spinner'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/8bit/tabs'

type MatchHistoryTab = {
  label: string
  value: MatchPhase | 'all'
}

const matchHistoryTabs: MatchHistoryTab[] = [
  { label: 'All Matches', value: 'all' },
  { label: 'Match Making', value: MatchPhase.QUEUE },
  { label: 'Swiss', value: MatchPhase.SWISS },
  { label: 'Tournament', value: MatchPhase.ELIMINATION },
]

interface TeamMatchHistoryProps {
  eventId: string
  matches?: Match[]
  isLoading?: boolean
  isError?: boolean
}

export default function TeamMatchHistory({
  eventId,
  matches = [],
  isLoading = false,
  isError = false,
}: Readonly<TeamMatchHistoryProps>) {
  return (
    <Card className="overflow-hidden border shadow-sm">
      <CardHeader className="border-b bg-muted/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <History className="size-5 text-muted-foreground" />
          <h3 className="text-xl font-semibold text-foreground">
            Match History
          </h3>
        </div>
      </CardHeader>

      {isLoading ? (
        <div className="flex min-h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : isError ? (
        <div className="flex min-h-40 items-center justify-center px-4 text-center text-sm text-destructive">
          Failed to load match history.
        </div>
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <div className="border-b px-4 py-3">
            <TabsList>
              {matchHistoryTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {matchHistoryTabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-0">
              <QueueMatchesList
                eventId={eventId}
                matches={
                  tab.value === 'all'
                    ? matches
                    : matches.filter((match) => match.phase === tab.value)
                }
                isInsideCard
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </Card>
  )
}
