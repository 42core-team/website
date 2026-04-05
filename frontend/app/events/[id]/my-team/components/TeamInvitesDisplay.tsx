"use client";

import type { Team } from "@/lib/backend/types/team";
import { useQueryClient } from "@tanstack/react-query";
import { usePlausible } from "next-plausible";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEventAccess } from "@/contexts/EventAccessContext";
import { browserTeamsApi } from "@/lib/backend/browser";
import { getBackendErrorMessage } from "@/lib/backend/http/errors";

interface TeamInvitesDisplayProps {
  pendingInvites: Team[];
}

export default function TeamInvitesDisplay({
  pendingInvites,
}: TeamInvitesDisplayProps) {
  const plausible = usePlausible();
  const queryClient = useQueryClient();

  const [invites, setInvites] = useState(pendingInvites);
  const [actionStates, setActionStates] = useState<
    Record<
      string,
      {
        isAccepting: boolean;
        isDeclining: boolean;
        message?: string;
      }
    >
  >({});
  const eventId = useParams().id as string;
  const { setEventAccess } = useEventAccess();

  const handleAcceptInvite = async (teamId: string) => {
    plausible("accept_team_invite");
    setActionStates(prev => ({
      ...prev,
      [teamId]: { ...prev[teamId], isAccepting: true, message: undefined },
    }));

    try {
      await browserTeamsApi.acceptTeamInvite(eventId, teamId);
      setEventAccess({ hasTeam: true });
      setInvites(prev => prev.filter(invite => invite.id !== teamId));
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["event", eventId, "my-team"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["event", eventId, "pending-invites"],
        }),
      ]);
    }
    catch (error) {
      setActionStates(prev => ({
        ...prev,
        [teamId]: {
          ...prev[teamId],
          isAccepting: false,
          message: getBackendErrorMessage(error),
        },
      }));
    }
  };

  const handleDeclineInvite = async (teamId: string) => {
    plausible("decline_team_invite");
    setActionStates(prev => ({
      ...prev,
      [teamId]: { ...prev[teamId], isDeclining: true, message: undefined },
    }));

    try {
      await browserTeamsApi.declineTeamInvite(eventId, teamId);
      setInvites(prev => prev.filter(invite => invite.id !== teamId));
      await queryClient.invalidateQueries({
        queryKey: ["event", eventId, "pending-invites"],
      });
    }
    catch (error) {
      setActionStates(prev => ({
        ...prev,
        [teamId]: {
          ...prev[teamId],
          isDeclining: false,
          message: getBackendErrorMessage(error),
        },
      }));
    }
  };

  return (
    <Card className="rounded-lg border">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">
          Team Invitations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {invites.length === 0
          ? (
              <p className="text-muted-foreground">No pending team invitations</p>
            )
          : (
              <div className="divide-y">
                {invites.map(invite => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="font-medium">{invite.name}</p>
                      <p className="text-sm text-muted-foreground">Invited</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {actionStates[invite.id]?.message && (
                        <span className="mr-2 text-sm text-destructive">
                          {actionStates[invite.id]?.message}
                        </span>
                      )}
                      <Button
                        size="sm"
                        isLoading={actionStates[invite.id]?.isAccepting}
                        disabled={actionStates[invite.id]?.isDeclining}
                        onClick={() => handleAcceptInvite(invite.id)}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        isLoading={actionStates[invite.id]?.isDeclining}
                        disabled={actionStates[invite.id]?.isAccepting}
                        onClick={() => handleDeclineInvite(invite.id)}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
      </CardContent>
    </Card>
  );
}
