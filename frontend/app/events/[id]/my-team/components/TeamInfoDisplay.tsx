"use client";

import type { Team, TeamMember } from "@/lib/backend/types/team";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePlausible } from "next-plausible";
import { useParams } from "next/navigation";
import { useState } from "react";
import TeamMatchHistory from "@/app/events/[id]/teams/[teamId]/TeamMatchHistory";
import { TeamInfoSection } from "@/components/team";
import { useEventAccess } from "@/contexts/EventAccessContext";
import {
  browserEventsApi,
  browserTeamsApi,
  browserTournamentApi,
} from "@/lib/backend/browser";

interface TeamInfoDisplayProps {
  team: Team;
  teamMembers: TeamMember[];
}

export default function TeamInfoDisplay({
  team: initialTeam,
  teamMembers: initialTeamMembers,
}: TeamInfoDisplayProps) {
  const plausible = usePlausible();
  const queryClient = useQueryClient();
  const { setEventAccess } = useEventAccess();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const eventId = useParams().id as string;

  const { data: githubOrg } = useQuery({
    queryKey: ["event", eventId, "github-org"],
    queryFn: () => browserEventsApi.getEventGithubOrg(eventId),
  });

  const { data: matches } = useQuery({
    queryKey: ["event", eventId, "matches"],
    queryFn: () => browserTournamentApi.getMatchesForTeam(initialTeam.id),
  });

  const { data: team } = useQuery<Team | null>({
    refetchInterval: 3000,
    queryKey: ["event", eventId, "my-team"],
    queryFn: () => browserTeamsApi.getMyEventTeam(eventId),
    initialData: initialTeam,
  });

  const { data: eventStarted = true } = useQuery({
    queryKey: ["team", team?.id, "event-started"],
    queryFn: () => browserTeamsApi.hasEventStarted(team!.id),
    enabled: !!team?.id,
  });

  const isRepoPending = !eventStarted || !githubOrg;

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["team", team?.id, "members"],
    queryFn: () => browserTeamsApi.getTeamMembers(team!.id),
    enabled: Boolean(team?.id),
    initialData: initialTeamMembers,
  });

  const leaveTeamMutation = useMutation({
    mutationFn: () => browserTeamsApi.leaveTeam(eventId),
    onMutate: () => {
      plausible("leave_team");
      setErrorMessage(null);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
    },
    onSuccess: async () => {
      setEventAccess({ hasTeam: false });
      queryClient.removeQueries({
        queryKey: ["team", team?.id, "members"],
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["event", eventId, "my-team"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["event", eventId, "pending-invites"],
        }),
      ]);
    },
  });

  async function handleLeaveTeam(): Promise<boolean> {
    try {
      await leaveTeamMutation.mutateAsync();
      return true;
    }
    catch {
      return false;
    }
  }

  if (!team) {
    return null;
  }

  return (
    <>
      {errorMessage && (
        <div className="bg-danger-50 border-danger-200 text-destructive-800 mb-4 rounded border px-4 py-3">
          {errorMessage}
        </div>
      )}
      <div className="space-y-4 py-3">
        <TeamInfoSection
          myTeam={team}
          onLeaveTeam={handleLeaveTeam}
          isLeaving={leaveTeamMutation.isPending}
          teamMembers={teamMembers}
          isRepoPending={isRepoPending}
          githubOrg={githubOrg ?? ""}
        />

        <TeamMatchHistory eventId={eventId} matches={matches || []} />
      </div>
    </>
  );
}
