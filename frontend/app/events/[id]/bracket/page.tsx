import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { isActionError } from "@/app/actions/errors";
import { isEventAdmin } from "@/app/actions/event";
import Actions from "@/app/events/[id]/bracket/actions";
import BracketTabs from "@/app/events/[id]/bracket/BracketTabs";
import {
  eventTeamsStandingsQueryFn,
  eventTeamsStandingsQueryKey,
  tournamentMatchesQueryFn,
  tournamentMatchesQueryKey,
  tournamentTeamCountQueryFn,
  tournamentTeamCountQueryKey,
} from "@/app/events/[id]/tournament-queries";

export const metadata = {
  title: "Tournament Bracket",
  description: "View the tournament bracket and match results.",
};

export default async function page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ adminReveal?: string }>;
}) {
  const eventId = (await params).id;
  const eventAdmin = await isEventAdmin(eventId);
  if (isActionError(eventAdmin)) {
    throw new Error("Failed to verify admin status");
  }
  const isAdminView = (await searchParams).adminReveal === "true";
  const queryClient = new QueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: tournamentMatchesQueryKey(eventId, isAdminView),
      queryFn: () => tournamentMatchesQueryFn(eventId, isAdminView),
    }),
    queryClient.prefetchQuery({
      queryKey: tournamentTeamCountQueryKey(eventId),
      queryFn: () => tournamentTeamCountQueryFn(eventId),
    }),
    queryClient.prefetchQuery({
      queryKey: eventTeamsStandingsQueryKey(eventId, isAdminView),
      queryFn: () => eventTeamsStandingsQueryFn(eventId, isAdminView),
    }),
  ]);

  return (
    <div className="flex flex-col gap-4 pb-8 md:gap-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-1.5 md:space-y-2">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Tournament Tree
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Follow the elimination bracket to see which teams advance and
            ultimately compete in the finals.
          </p>
        </div>
        {eventAdmin && (
          <div className="flex-shrink-0">
            <Actions />
          </div>
        )}
      </div>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <BracketTabs
          eventId={eventId}
          isEventAdmin={eventAdmin}
          adminReveal={isAdminView}
        />
      </HydrationBoundary>
    </div>
  );
}
