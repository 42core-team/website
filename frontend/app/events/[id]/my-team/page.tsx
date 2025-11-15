import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/utils/authOptions";
import { redirect } from "next/navigation";
import {
  getMyEventTeam,
  getTeamMembers,
  getUserPendingInvites,
  TeamMember,
} from "@/app/actions/team";
import { getEventById, isUserRegisteredForEvent } from "@/app/actions/event";
import TeamView from "./teamView";
import { isActionError } from "@/app/actions/errors";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";

export const metadata = {
  title: "My Team",
  description: "View and manage your team for this event in CORE Game.",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.id) {
    redirect("/login");
  }

  const eventId = (await params).id;

  const userRegistered = await isUserRegisteredForEvent(eventId);
  if (!userRegistered) {
    redirect(`/events/${eventId}`);
  }

  const event = await getEventById(eventId);
  if (isActionError(event)) {
    redirect(`/events/${eventId}`);
  }

  const team = await getMyEventTeam(eventId);

  if (!team && !event.canCreateTeam) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>Team creation closed</AlertTitle>
        <AlertDescription>
          Team creation for this event has ended. If you already have a team,
          you can view or manage it. Contact the event organizers for help.
        </AlertDescription>
      </Alert>
    );
  }

  // Fetch team members if user has a team
  let teamMembers: TeamMember[] = [];
  if (team) {
    teamMembers = await getTeamMembers(team.id);
  }

  // Fetch pending invites
  const pendingInvites = await getUserPendingInvites(eventId);

  return (
    <TeamView
      initialTeam={team}
      teamMembers={teamMembers}
      pendingInvites={pendingInvites}
    />
  );
}
