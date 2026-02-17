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
  leaveQueue,
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

  const { data: queueState, isLoading: isQueueStateLoading }
    = useQuery<QueueStateType>({
      queryKey: queueStateQueryKey(eventId),
      queryFn: () => queueStateQueryFn(eventId),
      initialData: props.queueState,
      refetchInterval: 2000,
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

  const leaveQueueMutation = useMutation({
    mutationFn: async () => {
      plausible("leave_queue");
      await leaveQueue(props.eventId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queueStateQueryKey(eventId),
      });
    },
    onError: async () => {
      await queryClient.invalidateQueries({
        queryKey: queueStateQueryKey(eventId),
      });
    },
  });

  // Tracking match state via queueState
  const effectiveMatch = queueState?.match;
  const matchState = effectiveMatch?.state;

  useEffect(() => {
    if (!matchState) {
      // If we lose the match (e.g. queue state resets), clear the cached state
      queryClient.setQueryData(["lastSeenMatchState", eventId], undefined);
      return;
    }

    const lastSeenState = queryClient.getQueryData<MatchState>([
      "lastSeenMatchState",
      eventId,
    ]);

    // Detect transition from IN_PROGRESS to FINISHED
    if (
      lastSeenState === MatchState.IN_PROGRESS
      && matchState === MatchState.FINISHED
      && effectiveMatch
    ) {
      // Refresh match history before redirecting
      queryClient.invalidateQueries({
        queryKey: queueMatchesQueryKey(eventId),
      });
      router.push(`/events/${eventId}/match/${effectiveMatch.id}`);
    }

    // Update the last seen state in the query client
    if (lastSeenState !== matchState) {
      queryClient.setQueryData(["lastSeenMatchState", eventId], matchState);
    }
  }, [matchState, effectiveMatch, eventId, router, queryClient]);

  if (isQueueStateLoading || !queueState) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <h1 className="text-2xl font-bold">Queue State</h1>
      <div className="mt-4 flex flex-col items-center justify-center gap-2">
        {matchState === MatchState.IN_PROGRESS
          ? (
              <Spinner size="xl" className="text-green-600" />
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
                {queueState.inQueue
                  ? (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <p className="text-sm">
                          Queue Count:
                          {queueState.queueCount}
                        </p>
                        <Button
                          disabled={leaveQueueMutation.isPending}
                          variant="destructive"
                          onClick={() => {
                            leaveQueueMutation.mutate();
                          }}
                        >
                          {leaveQueueMutation.isPending ? "Leaving..." : "Leave Queue"}
                        </Button>
                      </div>
                    )
                  : (
                      <Button
                        disabled={joinQueueMutation.isPending}
                        onClick={() => {
                          joinQueueMutation.mutate();
                        }}
                      >
                        {joinQueueMutation.isPending ? "Joining..." : "play"}
                      </Button>
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
