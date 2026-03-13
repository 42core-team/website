"use client";

import type { Team } from "@/app/actions/team";
import type { Match } from "@/app/actions/tournament-model";
import { BarChart3, Network } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/useTabParam";
import BracketRankingTable from "./BracketRankingTable";
import GraphView from "./graphView";

interface BracketTabsProps {
  eventId: string;
  matches: Match[];
  teams: Team[];
  isEventAdmin: boolean;
  teamCount: number;
}

export default function BracketTabs({
  eventId,
  matches,
  teams,
  isEventAdmin,
  teamCount,
}: BracketTabsProps) {
  const { currentTab, onTabChange } = useTabParam("graph");

  return (
    <Tabs value={currentTab} onValueChange={onTabChange} className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <TabsList className="border bg-muted/50 p-1">
          <TabsTrigger value="graph" className="gap-2 px-4">
            <Network className="h-4 w-4" />
            Graph
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-2 px-4">
            <BarChart3 className="h-4 w-4" />
            Ranking
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="graph" className="mt-0">
        <div className="relative h-[60vh] min-h-[400px] overflow-hidden rounded-xl border bg-card/50 text-card-foreground shadow-sm md:h-[75vh] md:min-h-[600px] md:rounded-2xl">
          <GraphView
            matches={matches}
            teamCount={teamCount}
            isEventAdmin={isEventAdmin}
          />
        </div>
      </TabsContent>

      <TabsContent value="ranking" className="mt-0">
        <BracketRankingTable
          teams={teams}
          matches={matches}
          eventId={eventId}
          isEventAdmin={isEventAdmin}
        />
      </TabsContent>
    </Tabs>
  );
}
