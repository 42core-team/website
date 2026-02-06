"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Network } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import GraphView from "./graphView";
import RankingTable from "./RankingTable";
import type { Team } from "@/app/actions/team";
import type { Match } from "@/app/actions/tournament-model";

interface GroupPhaseTabsProps {
  eventId: string;
  matches: Match[];
  teams: Team[];
  eventAdmin: boolean;
  isAdminView: boolean;
  advancementCount: number;
}

export default function GroupPhaseTabs({
  eventId,
  matches,
  teams,
  eventAdmin,
  isAdminView,
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
      <div className="flex items-center justify-between mb-4">
        <TabsList className="bg-muted/50 p-1 border">
          <TabsTrigger value="graph" className="gap-2 px-4">
            <Network className="w-4 h-4" />
            Graph
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-2 px-4">
            <BarChart3 className="w-4 h-4" />
            Ranking
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="graph" className="mt-0">
        <div className="rounded-xl md:rounded-2xl border bg-card/50 text-card-foreground shadow-sm overflow-hidden h-[60vh] md:h-[75vh] min-h-[400px] md:min-h-[600px] relative">
          <GraphView
            matches={matches}
            eventAdmin={eventAdmin}
            isAdminView={isAdminView}
          />
        </div>
      </TabsContent>

      <TabsContent value="ranking" className="mt-0">
        <div className="rounded-xl md:rounded-2xl border bg-card/50 text-card-foreground shadow-sm overflow-hidden p-1 md:p-4">
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
