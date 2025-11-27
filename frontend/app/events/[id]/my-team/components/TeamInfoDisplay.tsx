"use client";
import type { Team, TeamMember } from "@/app/actions/team";
import { useMutation, useQuery } from "@tanstack/react-query";
import { usePlausible } from "next-plausible";
import { useParams } from "next/navigation";
import { useState } from "react";
import axiosInstance from "@/app/actions/axios";
import { isActionError } from "@/app/actions/errors";
import { leaveTeam } from "@/app/actions/team";
import { TeamInfoSection } from "@/components/team";

interface TeamInfoDisplayProps {
  team: Team;
  teamMembers: TeamMember[];
}

export default function TeamInfoDisplay({
  team: initialTeam,
  teamMembers: initialTeamMembers,
}: TeamInfoDisplayProps) {
  const plausible = usePlausible();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRepoPending] = useState<boolean>(false);
  const eventId = useParams().id as string;

  const { data: team } = useQuery<Team | null>({
    refetchInterval: 3000,
    queryKey: ["event", eventId, "my-team"],
    queryFn: async () => {
      const response = await axiosInstance.get<Team | null>(
        `/team/event/${eventId}/my`,
      );
      return response.data;
    },
    initialData: initialTeam,
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["team", team?.id, "members"],
    queryFn: async () => {
      const response = await axiosInstance.get<TeamMember[]>(
        `/team/${team?.id}/members`,
      );
      return response.data;
    },
    enabled: Boolean(team?.id),
    initialData: initialTeamMembers,
  });

  const leaveTeamMutation = useMutation({
    mutationFn: async () => {
      const result = await leaveTeam(eventId);
      if (isActionError(result)) {
        throw new Error(result.error);
      }
    },
    onMutate: () => {
      plausible("leave_team");
      setErrorMessage(null);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    },
  });

  async function handleLeaveTeam(): Promise<boolean> {
    try {
      await leaveTeamMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  }

  if (!team) {
    return null;
  }

  return (
    <>
      {errorMessage && (
        <div className="bg-danger-50 border border-danger-200 text-destructive-800 px-4 py-3 rounded mb-4">
          {errorMessage}
        </div>
      )}
      <TeamInfoSection
        myTeam={team}
        onLeaveTeam={handleLeaveTeam}
        isLeaving={leaveTeamMutation.isPending}
        teamMembers={teamMembers}
        isRepoPending={isRepoPending}
      />
    </>
  );
}
