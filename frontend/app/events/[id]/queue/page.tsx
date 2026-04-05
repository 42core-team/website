import type { Metadata } from "next/dist/lib/metadata/types/metadata-interface";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { AlertCircleIcon } from "lucide-react";
import QueueState from "@/app/events/[id]/queue/queueState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { serverTeamsApi } from "@/lib/backend/server";
import {
  queueMatchesQueryKey,
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

  const myTeam = await serverTeamsApi.getMyEventTeam(id);

  if (!myTeam) {
    return (
      <Alert variant="destructive" className="mt-6">
        <AlertCircleIcon />
        <AlertTitle>You are not part of any team</AlertTitle>
        <AlertDescription>
          Join or create a team to access the event queue. You can do this in
          the
          {" "}
          <a href={`/events/${id}/my-team`} className="underline">
            My Team
          </a>
          {" "}
          section.
        </AlertDescription>
      </Alert>
    );
  }

  const queryClient = new QueryClient();

  const queueState = await serverTeamsApi.getQueueState(id);
  queryClient.setQueryData(queueStateQueryKey(id), queueState);

  const queueMatches = await serverTeamsApi.getQueueMatches(id);
  const sortedQueueMatches = queueMatches.map(match => ({
    ...match,
    teams: [...match.teams].sort((a, _b) => (a.id === myTeam.id ? -1 : 1)),
  }));
  queryClient.setQueryData(queueMatchesQueryKey(id), sortedQueueMatches);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <QueueState
        queueState={queueState}
        eventId={id}
        team={myTeam}
        queueMatches={sortedQueueMatches}
      />
    </HydrationBoundary>
  );
}
