"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Team, acceptTeamInvite, declineTeamInvite } from "@/app/actions/team";
import { isActionError } from "@/app/actions/errors";
import { usePlausible } from "next-plausible";

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
    setActionStates((prev) => ({
      ...prev,
      [teamId]: { ...prev[teamId], isAccepting: true, message: undefined },
    }));

    const result = await acceptTeamInvite(eventId, teamId);

    if (isActionError(result)) {
      setActionStates((prev) => ({
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
    setActionStates((prev) => ({
      ...prev,
      [teamId]: { ...prev[teamId], isDeclining: true, message: undefined },
    }));

    const result = await declineTeamInvite(eventId, teamId);
    if (isActionError(result)) {
      setActionStates((prev) => ({
        ...prev,
        [teamId]: {
          ...prev[teamId],
          isDeclining: false,
          message: result.error,
        },
      }));
      return;
    }
    setInvites((prev) => prev.filter((invite) => invite.id !== teamId));
  };

  return (
    <div className="bg-default-50 p-6 rounded-lg border border-default-200 mb-6">
      <h2 className="text-xl font-semibold mb-4">Team Invitations</h2>
      {invites.length === 0 ? (
        <p className="text-default-500">No pending team invitations</p>
      ) : (
        <div className="divide-y divide-default-200">
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="py-3 flex items-center justify-between"
            >
              <div>
                <p className="font-medium">{invite.name}</p>
                <p className="text-sm text-default-500">Invited</p>
              </div>
              <div className="flex gap-2 items-center">
                {actionStates[invite.id]?.message && (
                  <span className="text-danger text-sm mr-2">
                    {actionStates[invite.id]?.message}
                  </span>
                )}
                <Button
                  color="primary"
                  size="sm"
                  // TODO: isLoading={actionStates[invite.id]?.isAccepting}
                  disabled={actionStates[invite.id]?.isDeclining}
                  onClick={() => handleAcceptInvite(invite.id)}
                >
                  Accept
                </Button>
                <Button
                  color="default"
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
    </div>
  );
}
