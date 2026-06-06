"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, Network } from "lucide-react";
import { useMemo } from "react";
import {
  eventTeamsStandingsQueryFn,
  eventTeamsStandingsQueryKey,
  tournamentMatchesQueryFn,
  tournamentMatchesQueryKey,
  tournamentTeamCountQueryFn,
  tournamentTeamCountQueryKey,
} from "@/app/events/[id]/tournament-queries";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInvalidateOnMatchReturn } from "@/hooks/useInvalidateOnMatchReturn";
import { useTabParam } from "@/hooks/useTabParam";
import BracketRankingTable from "./BracketRankingTable";
import GraphView from "./graphView";

interface BracketTabsProps {
  eventId: string;
  isEventAdmin: boolean;
  adminReveal: boolean;
}

export default function BracketTabs({
  eventId,
  isEventAdmin,
  adminReveal,
}: BracketTabsProps) {
  const queryKeys = useMemo(
    () => [
      tournamentMatchesQueryKey(eventId, adminReveal),
      tournamentTeamCountQueryKey(eventId),
      eventTeamsStandingsQueryKey(eventId, adminReveal),
    ],
    [eventId, adminReveal],
  );

  useInvalidateOnMatchReturn(queryKeys);
  const { currentTab, onTabChange } = useTabParam("graph");
  const matchesQuery = useQuery({
    queryKey: tournamentMatchesQueryKey(eventId, adminReveal),
    queryFn: () => tournamentMatchesQueryFn(eventId, adminReveal),
  });
  const teamCountQuery = useQuery({
    queryKey: tournamentTeamCountQueryKey(eventId),
    queryFn: () => tournamentTeamCountQueryFn(eventId),
  });
  const teamsQuery = useQuery({
    queryKey: eventTeamsStandingsQueryKey(eventId, adminReveal),
    queryFn: () => eventTeamsStandingsQueryFn(eventId, adminReveal),
  });

  const matches = matchesQuery.data;
  const teamCount = teamCountQuery.data;
  const teams = teamsQuery.data;
  const isLoading = [matchesQuery, teamCountQuery, teamsQuery].some(
    query => query.isPending && query.data === undefined,
  );
  const hasError = [matchesQuery, teamCountQuery, teamsQuery].some(
    query => query.isError && query.data === undefined,
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-xl border bg-card/50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (hasError || !matches || teamCount === undefined || !teams) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        Failed to load tournament bracket data.
      </div>
    );
  }

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
