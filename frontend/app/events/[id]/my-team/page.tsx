import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { isActionError } from "@/app/actions/errors";
import { getEventById, isUserRegisteredForEvent } from "@/app/actions/event";
import { authOptions } from "@/app/utils/authOptions";
import { serverTeamsApi } from "@/lib/backend/server";
import {
  myTeamQueryKey,
  pendingInvitesQueryKey,
  teamMembersQueryKey,
} from "./queries";
import TeamView from "./teamView";

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
    redirect("/");
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

  const queryClient = new QueryClient();

  const team = await serverTeamsApi.getMyEventTeam(eventId);
  queryClient.setQueryData(myTeamQueryKey(eventId), team);
  const teamId = team?.id;

  if (teamId) {
    const teamMembers = await serverTeamsApi.getTeamMembers(teamId);
    queryClient.setQueryData(teamMembersQueryKey(teamId), teamMembers);
  }

  const pendingInvites = await serverTeamsApi.getUserPendingInvites(eventId);
  queryClient.setQueryData(pendingInvitesQueryKey(eventId), pendingInvites);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TeamView eventId={eventId} canCreateTeam={event.canCreateTeam} />
    </HydrationBoundary>
  );
}
