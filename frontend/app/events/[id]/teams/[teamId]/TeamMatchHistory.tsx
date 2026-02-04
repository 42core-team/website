"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QueueMatchesList from "@/components/QueueMatchesList";
import { MatchPhase } from "@/app/actions/tournament-model";
import type { Match } from "@/app/actions/tournament-model";

interface TeamMatchHistoryProps {
  eventId: string;
  matches: Match[];
}

export default function TeamMatchHistory({
  eventId,
  matches,
}: TeamMatchHistoryProps) {
  return (
    <Tabs defaultValue="all" className="w-full">
      <div className="px-4 py-3 border-b">
        <TabsList>
          <TabsTrigger value="all">All Matches</TabsTrigger>
          <TabsTrigger value={MatchPhase.QUEUE}>Queue</TabsTrigger>
          <TabsTrigger value={MatchPhase.SWISS}>Swiss</TabsTrigger>
          <TabsTrigger value={MatchPhase.ELIMINATION}>Tournament</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="all" className="mt-0">
        <QueueMatchesList eventId={eventId} matches={matches} isInsideCard />
      </TabsContent>
      <TabsContent value={MatchPhase.QUEUE} className="mt-0">
        <QueueMatchesList
          eventId={eventId}
          matches={matches.filter((m) => m.phase === MatchPhase.QUEUE)}
          isInsideCard
        />
      </TabsContent>
      <TabsContent value={MatchPhase.SWISS} className="mt-0">
        <QueueMatchesList
          eventId={eventId}
          matches={matches.filter((m) => m.phase === MatchPhase.SWISS)}
          isInsideCard
        />
      </TabsContent>
      <TabsContent value={MatchPhase.ELIMINATION} className="mt-0">
        <QueueMatchesList
          eventId={eventId}
          matches={matches.filter((m) => m.phase === MatchPhase.ELIMINATION)}
          isInsideCard
        />
      </TabsContent>
    </Tabs>
  );
}
