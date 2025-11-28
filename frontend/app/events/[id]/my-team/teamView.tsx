"use client";

import type { Team, TeamMember } from "@/app/actions/team";
import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon } from "lucide-react";
import axiosInstance from "@/app/actions/axios";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import TeamCreationForm from "./components/TeamCreationForm";
import TeamInfoDisplay from "./components/TeamInfoDisplay";
import TeamInvitesDisplay from "./components/TeamInvitesDisplay";

interface TeamViewProps {
  eventId: string;
  canCreateTeam: boolean;
}

export default function TeamView({ eventId, canCreateTeam }: TeamViewProps) {
  const {
    data: team,
    isLoading: isTeamLoading,
    isError: isTeamError,
  } = useQuery<Team | null>({
    queryKey: ["event", eventId, "my-team"],
    queryFn: async () => {
      const response = await axiosInstance.get<Team | null>(
        `/team/event/${eventId}/my`,
      );
      return response.data;
    },
  });

  const teamId = team?.id;

  const { data: teamMembers = [], isError: isTeamMembersError } = useQuery<
    TeamMember[]
  >({
    queryKey: ["team", teamId, "members"],
    queryFn: async () => {
      const response = await axiosInstance.get<TeamMember[]>(
        `/team/${teamId}/members`,
      );
      return response.data;
    },
    enabled: !!teamId,
  });

  const { data: pendingInvites = [], isError: isInvitesError } = useQuery<
    Team[]
  >({
    queryKey: ["event", eventId, "pending-invites"],
    queryFn: async () => {
      const response = await axiosInstance.get<Team[]>(
        `/team/event/${eventId}/pending`,
      );
      return response.data;
    },
  });

  const isLoading = isTeamLoading;
  const isError = isTeamError || isTeamMembersError || isInvitesError;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto mb-8 mt-3">
        <Spinner />
      </div>
    );
  }

  if (!team && !canCreateTeam) {
    return (
      <div className="max-w-4xl mx-auto mb-8 mt-3">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Team creation closed</AlertTitle>
          <AlertDescription>
            Team creation for this event has ended. If you already have a team,
            you can view or manage it. Contact the event organizers for help.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto mb-8 mt-3">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>
            We couldn't load your team information. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto mb-8 mt-3">
      {team ? (
        <TeamInfoDisplay team={team} teamMembers={teamMembers} />
      ) : (
        <>
          <TeamCreationForm />
          <div className="mb-5"></div>
          <TeamInvitesDisplay pendingInvites={pendingInvites} />
        </>
      )}
    </div>
  );
}
