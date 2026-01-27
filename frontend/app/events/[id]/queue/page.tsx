import type { Metadata } from "next/dist/lib/metadata/types/metadata-interface";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { AlertCircleIcon } from "lucide-react";
import { getMyEventTeam } from "@/app/actions/team";
import QueueState from "@/app/events/[id]/queue/queueState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  queueMatchesQueryFn,
  queueMatchesQueryKey,
  queueStateQueryFn,
  queueStateQueryKey,
} from "./queries";

export const metadata: Metadata = {
  title: "Queue",
  description:
    "Join the event queue to play matches against other participants.",
};

export default async function EventQueuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const myTeam = await getMyEventTeam(id);

  if (!myTeam) {
    return (
      <Alert variant="destructive" className="mt-6">
        <AlertCircleIcon />
        <AlertTitle>You are not part of any team</AlertTitle>
        <AlertDescription>
          Join or create a team to access the event queue. You can do this in
          the{" "}
          <a href={`/events/${id}/my-team`} className="underline">
            My Team
          </a>{" "}
          section.
        </AlertDescription>
      </Alert>
    );
  }

  const queryClient = new QueryClient();

  const queueState = await queryClient.fetchQuery({
    queryKey: queueStateQueryKey(id),
    queryFn: () => queueStateQueryFn(id),
  });

  const queueMatches = await queryClient.fetchQuery({
    queryKey: queueMatchesQueryKey(id),
    queryFn: () => queueMatchesQueryFn(id),
  });

  const sortedQueueMatches = queueMatches.map((match) => ({
    ...match,
    teams: match.teams.sort((a, _b) => (a.id === myTeam.id ? -1 : 1)),
  }));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="container mx-auto py-3">
        <h1 className="text-3xl font-bold mb-8">Event Queue</h1>
        <p className="text-lg text-muted-foreground mb-4">
          Play against other participants in the queue to test your code.
        </p>
        <p className="text-sm text-muted-foreground">
          If you have any questions, please contact the event organizers.
        </p>

        <div className="mt-8">
          <QueueState
            queueState={queueState}
            eventId={id}
            team={myTeam}
            queueMatches={sortedQueueMatches}
          />
        </div>
      </div>
    </HydrationBoundary>
  );
}
