import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import {
  getUserPendingInvites,
  acceptTeamInvite,
  declineTeamInvite,
  Team,
} from "@/app/actions/team";
import { isActionError } from "@/app/actions/errors";

export const TeamInvitesSection = () => {
  const [invites, setInvites] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
  const { data: session } = useSession();

  useEffect(() => {
    async function fetchInvites() {
      try {
        const userInvites = await getUserPendingInvites(eventId);
        setInvites(userInvites);
      } catch (error) {
        console.error("Error fetching invites:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (session?.user?.id) {
      setIsLoading(true);
      fetchInvites();
    } else {
      setIsLoading(false);
    }
  }, [session, eventId]);

  const handleAcceptInvite = async (teamId: string) => {
    if (!session?.user?.id) {
      console.error("User not authenticated");
      return;
    }

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

    setInvites((prev) => prev.filter((invite) => invite.id !== teamId));
    window.location.reload();
  };

  const handleDeclineInvite = async (teamId: string) => {
    if (!session?.user?.id) {
      console.error("User not authenticated");
      return;
    }

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

  if (!session?.user?.id) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="bg-default-50 p-6 rounded-lg border border-default-200 mb-6">
        <h2 className="text-xl font-semibold mb-4">Team Invitations</h2>
        <p className="text-muted-foreground">Loading invitations...</p>
      </div>
    );
  }

  return (
    <div className="bg-default-50 p-6 rounded-lg border border-default-200 mb-6">
      <h2 className="text-xl font-semibold mb-4">Team Invitations</h2>
      {invites.length === 0 ? (
        <p className="text-muted-foreground">No pending team invitations</p>
      ) : (
        <div className="divide-y divide-default-200">
          {invites.map((invite) => (
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
                  <span className="text-danger text-sm mr-2">
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
                  variant="destructive"
                  size="sm"
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
};

export default TeamInvitesSection;
