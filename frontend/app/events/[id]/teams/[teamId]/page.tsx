import type { Metadata } from "next";
import { notFound } from "next/navigation";
import React from "react";
import { isActionError } from "@/app/actions/errors";
import { getTeamById, getTeamMembers } from "@/app/actions/team";
import { getMatchesForTeam } from "@/app/actions/tournament";
import QueueMatchesList from "@/components/QueueMatchesList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History } from "lucide-react";
import BackButton from "./BackButton";
import TeamUserTable from "./TeamUserTable";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; teamId: string }>;
}): Promise<Metadata> {
  const { teamId } = await params;
  const team = await getTeamById(teamId);

  if (isActionError(team) || !team) {
    return {
      title: "Team Not Found",
      description: "This team could not be found on the CORE Game platform.",
    };
  }

  return {
    title: `Team ${team.name}`,
    description: `Details for team ${team.name} in CORE Game.`,
  };
}

interface TeamDetailPageProps {
  params: Promise<{
    id: string;
    teamId: string;
  }>;
}

export default async function TeamDetailPage({ params }: TeamDetailPageProps) {
  const { id: eventId, teamId } = await params;

  const members = await getTeamMembers(teamId);
  const teamInfo = await getTeamById(teamId);
  if (!teamInfo || !members) {
    notFound();
  }

  const matches = await getMatchesForTeam(teamId);

  return (
    <div className="py-3 space-y-8">
      <Card className="px-5 py-4">
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center gap-4">
            <BackButton />
            <h2 className="text-2xl font-bold">
              Team
              {" "}
              {teamInfo.name}
            </h2>
          </div>
        </div>
        <TeamUserTable members={members} />
      </Card>

      <Card className="overflow-hidden border shadow-sm">
        <CardHeader className="px-5 py-4 bg-muted/10 border-b">
          <div className="flex items-center gap-2">
            <History className="size-5 text-muted-foreground" />
            <h3 className="text-xl font-semibold text-foreground">Match History</h3>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <QueueMatchesList
            eventId={eventId}
            matches={matches}
            hideUuid
            hideReplay
            isInsideCard
          />
        </CardContent>
      </Card>
    </div>
  );
}
