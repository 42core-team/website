"use client";
import type { Team } from "@/app/actions/team";
import { usePlausible } from "next-plausible";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { isActionError } from "@/app/actions/errors";
import { acceptTeamInvite, declineTeamInvite } from "@/app/actions/team";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TeamInvitesDisplayProps {
  pendingInvites: Team[];
}

export default function TeamInvitesDisplay({
  pendingInvites,
}: TeamInvitesDisplayProps) {
  const plausible = usePlausible();

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
  const router = useRouter();

  const handleAcceptInvite = async (teamId: string) => {
    plausible("accept_team_invite");
    setActionStates(prev => ({
      ...prev,
      [teamId]: { ...prev[teamId], isAccepting: true, message: undefined },
    }));

    const result = await acceptTeamInvite(eventId, teamId);

    if (isActionError(result)) {
      setActionStates(prev => ({
        ...prev,
        [teamId]: {
          ...prev[teamId],
          isAccepting: false,
          message: result.error,
        },
      }));
      return;
    }

    // Use Next.js router to refresh the page
    router.refresh();
  };

  const handleDeclineInvite = async (teamId: string) => {
    plausible("decline_team_invite");
    setActionStates(prev => ({
      ...prev,
      [teamId]: { ...prev[teamId], isDeclining: true, message: undefined },
    }));

    const result = await declineTeamInvite(eventId, teamId);
    if (isActionError(result)) {
      setActionStates(prev => ({
        ...prev,
        [teamId]: {
          ...prev[teamId],
          isDeclining: false,
          message: result.error,
        },
      }));
      return;
    }
    setInvites(prev => prev.filter(invite => invite.id !== teamId));
  };

  return (
    <Card className="rounded-lg border">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Team Invitations</CardTitle>
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
                    className="py-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">{invite.name}</p>
                      <p className="text-sm text-muted-foreground">Invited</p>
                    </div>
                    <div className="flex gap-2 items-center">
                      {actionStates[invite.id]?.message && (
                        <span className="text-destructive text-sm mr-2">
                          {actionStates[invite.id]?.message}
                        </span>
                      )}
                      <Button
                        size="sm"
                        // TODO: isLoading={actionStates[invite.id]?.isAccepting}
                        disabled={actionStates[invite.id]?.isDeclining}
                        onClick={() => handleAcceptInvite(invite.id)}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        // TODO: isLoading={actionStates[invite.id]?.isDeclining}
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
