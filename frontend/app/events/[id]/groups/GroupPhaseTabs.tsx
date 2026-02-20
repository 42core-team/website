"use client";

import type { Team } from "@/app/actions/team";
import type { Match } from "@/app/actions/tournament-model";
import { BarChart3, Network } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GraphView from "./graphView";
import RankingTable from "./RankingTable";

interface GroupPhaseTabsProps {
  eventId: string;
  matches: Match[];
  teams: Team[];
  isAdminView: boolean;
  advancementCount: number;
}

export default function GroupPhaseTabs({
  eventId,
  matches,
  teams,
  isEventAdmin,
  advancementCount,
}: GroupPhaseTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentTab = searchParams.get("tab") || "graph";

  const onTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

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
          <GraphView matches={matches} isEventAdmin={isEventAdmin} />
        </div>
      </TabsContent>

      <TabsContent value="ranking" className="mt-0">
        <div className="overflow-hidden rounded-xl border bg-card/50 p-1 text-card-foreground shadow-sm md:rounded-2xl md:p-4">
          <RankingTable
            teams={teams}
            matches={matches}
            eventId={eventId}
            advancementCount={advancementCount}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
