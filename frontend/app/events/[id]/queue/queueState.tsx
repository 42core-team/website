"use client";
import type { Team } from "@/app/actions/team";
import type { QueueState as QueueStateType } from "@/app/actions/team.model";
import type { Match } from "@/app/actions/tournament-model";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePlausible } from "next-plausible";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { MatchState } from "@/app/actions/tournament-model";
import QueueMatchesList from "@/components/QueueMatchesList";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  joinQueue,
  queueMatchesQueryFn,
  queueMatchesQueryKey,
  queueStateQueryFn,
  queueStateQueryKey,
} from "./queries";

export default function QueueState(props: {
  queueState: QueueStateType;
  eventId: string;
  team: Team;
  queueMatches: Match[];
}) {
  const plausible = usePlausible();
  const router = useRouter();
  const { id } = useParams();
  const eventId = id as string;

  const queryClient = useQueryClient();

  const {
    data: queueState,
    isLoading: isQueueStateLoading,
  } = useQuery<QueueStateType>({
    queryKey: queueStateQueryKey(eventId),
    queryFn: () => queueStateQueryFn(eventId),
    initialData: props.queueState,
    refetchInterval: 600,
  });

  const { data: queueMatches = [] } = useQuery<Match[]>({
    queryKey: queueMatchesQueryKey(eventId),
    queryFn: () => queueMatchesQueryFn(eventId),
    initialData: props.queueMatches,
  });

  const joinQueueMutation = useMutation({
    mutationFn: async () => {
      plausible("join_queue");
      await joinQueue(props.eventId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queueStateQueryKey(eventId),
      });
    },
  });

  useEffect(() => {
    if (!queueState) {
      return;
    }

    if (queueState.match?.state === MatchState.IN_PROGRESS) {
      return;
    }

    const previousMatchState = props.queueState.match?.state;
    if (
    previousMatchState === MatchState.IN_PROGRESS
      && queueState.match
    ) {
      router.push(`/events/${eventId}/match/${queueState.match.id}`);
    }
  }, [queueState, router, eventId, props.queueState.match?.state]);

  if (isQueueStateLoading || !queueState) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <h1 className="text-2xl font-bold">Queue State</h1>
      <div className="mt-4 flex flex-col items-center justify-center gap-2">
        {queueState?.match?.state === MatchState.IN_PROGRESS
          ? (
            <Spinner color="success" />
          )
          : (
            <>
              <p className="text-lg">
                Team:
                {props.team.name}
              </p>
              <p
                className={cn(
                  "text-sm text-muted-foreground",
                  queueState.inQueue ? "text-green-500" : "",
                )}
              >
                Status:
                {" "}
                {queueState.inQueue ? "In Queue" : "Not in Queue"}
              </p>
              {!queueState.inQueue
                ? (
                  <Button
                    disabled={joinQueueMutation.isPending}
                    onClick={() => {
                      joinQueueMutation.mutate();
                    }}
                  >
                    {joinQueueMutation.isPending ? "Joining..." : "play"}
                  </Button>
                )
                : (
                  <p className="text-sm">
                    Queue Count:
                    {queueState.queueCount}
                  </p>
                )}
            </>
          )}
      </div>

      <div className="mt-8 w-full max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold">Past Matches</h2>
        <QueueMatchesList eventId={props.eventId} matches={queueMatches} />
      </div>
    </div>
  );
}
