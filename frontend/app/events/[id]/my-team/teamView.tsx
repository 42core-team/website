"use client";

import type { Team, TeamMember } from "@/app/actions/team";
import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import TeamCreationForm from "./components/TeamCreationForm";
import TeamInfoDisplay from "./components/TeamInfoDisplay";
import TeamInvitesDisplay from "./components/TeamInvitesDisplay";
import {
  myTeamQueryFn,
  myTeamQueryKey,
  pendingInvitesQueryFn,
  pendingInvitesQueryKey,
  teamMembersQueryFn,
  teamMembersQueryKey,
} from "./queries";

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
    queryKey: myTeamQueryKey(eventId),
    queryFn: () => myTeamQueryFn(eventId),
  });

  const teamId = team?.id;

  const {
    data: teamMembers = [],
    isError: isTeamMembersError,
    isLoading: isTeamMembersLoading,
  } = useQuery<TeamMember[]>({
    queryKey: teamMembersQueryKey(teamId),
    queryFn: () => teamMembersQueryFn(teamId),
    enabled: !!teamId,
  });

  const {
    data: pendingInvites = [],
    isError: isInvitesError,
    isLoading: isInviteLoading,
  } = useQuery<Team[]>({
    queryKey: pendingInvitesQueryKey(eventId),
    queryFn: () => pendingInvitesQueryFn(eventId),
  });

  const isLoading = isTeamLoading || isTeamMembersLoading || isInviteLoading;
  const isError = isTeamError || isTeamMembersError || isInvitesError;

  if (isLoading) {
    return (
      <div className="mx-auto mt-3 mb-8 max-w-4xl">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto mt-3 mb-8 max-w-4xl">
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

  if (!team && !canCreateTeam) {
    return (
      <div className="mx-auto mt-3 mb-8 max-w-4xl">
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

  return (
    <div className="mx-auto mt-3 mb-8 max-w-4xl">
      {team
        ? (
            <TeamInfoDisplay team={team} teamMembers={teamMembers} />
          )
        : (
            <>
              <TeamCreationForm />
              <div className="mb-5"></div>
              <TeamInvitesDisplay pendingInvites={pendingInvites} />
            </>
          )}
    </div>
  );
}
