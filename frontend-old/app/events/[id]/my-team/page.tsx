import type { Team } from "@/app/actions/team";
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
import {
  myTeamQueryFn,
  myTeamQueryKey,
  pendingInvitesQueryFn,
  pendingInvitesQueryKey,
  teamMembersQueryFn,
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

  const team = await queryClient.fetchQuery({
    queryKey: myTeamQueryKey(eventId),
    queryFn: () => myTeamQueryFn(eventId),
  });

  const teamId = (team as Team | null)?.id;

  if (teamId) {
    await queryClient.prefetchQuery({
      queryKey: teamMembersQueryKey(teamId),
      queryFn: () => teamMembersQueryFn(teamId),
    });
  }

  await queryClient.prefetchQuery({
    queryKey: pendingInvitesQueryKey(eventId),
    queryFn: () => pendingInvitesQueryFn(eventId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TeamView eventId={eventId} canCreateTeam={event.canCreateTeam} />
    </HydrationBoundary>
  );
}
