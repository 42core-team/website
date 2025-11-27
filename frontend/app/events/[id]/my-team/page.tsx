import type { Team, TeamMember } from "@/app/actions/team";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import axiosInstance from "@/app/actions/axios";
import { isActionError } from "@/app/actions/errors";
import { getEventById, isUserRegisteredForEvent } from "@/app/actions/event";
import { authOptions } from "@/app/utils/authOptions";
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
  await queryClient.prefetchQuery({
    queryKey: ["event", eventId, "my-team"],
    queryFn: async () => {
      const response = await axiosInstance.get<Team | null>(
        `/team/event/${eventId}/my`,
      );
      return response.data;
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TeamView eventId={eventId} canCreateTeam={event.canCreateTeam} />
    </HydrationBoundary>
  );
}
