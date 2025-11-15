import React from "react";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getTeamById, getTeamMembers } from "@/app/actions/team";
import TeamUserTable from "./TeamUserTable";
import BackButton from "./BackButton";
import { Metadata } from "next";
import { isActionError } from "@/app/actions/errors";

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
  const { teamId, id } = await params;

  const members = await getTeamMembers(teamId);
  const teamInfo = await getTeamById(teamId);
  if (!teamInfo || !members) {
    notFound();
  }

  return (
    <div className="py-3 space-y-8">
      <Card className="px-5 py-4">
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center gap-4">
            <BackButton />
            <h1 className="text-2xl font-bold">Team {teamInfo.name}</h1>
          </div>
        </div>
        <TeamUserTable members={members} />
      </Card>
    </div>
  );
}
