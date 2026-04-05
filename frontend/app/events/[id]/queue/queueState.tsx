"use client";
import type { QueueState as QueueStateType, Team } from "@/lib/backend/types/team";
import type { Match } from "@/lib/backend/types/tournament";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, LogIn, LogOut, Swords, Users } from "lucide-react";
import { usePlausible } from "next-plausible";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import QueueMatchesList from "@/components/QueueMatchesList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { MatchState } from "@/lib/backend/types/tournament";
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

  const effectiveMatch = queueState?.match;
  const matchState = effectiveMatch?.state;

  useEffect(() => {
    if (!matchState) {
      queryClient.setQueryData(["lastSeenMatchState", eventId], undefined);
      return;
    }

    const lastSeenState = queryClient.getQueryData<MatchState>([
      "lastSeenMatchState",
      eventId,
    ]);

    if (
      lastSeenState === MatchState.IN_PROGRESS
      && matchState === MatchState.FINISHED
      && effectiveMatch
    ) {
      queryClient.invalidateQueries({
        queryKey: queueMatchesQueryKey(eventId),
      });
      router.push(`/events/${eventId}/match/${effectiveMatch.id}`);
    }

    if (lastSeenState !== matchState) {
      queryClient.setQueryData(["lastSeenMatchState", eventId], matchState);
    }
  }, [matchState, effectiveMatch, eventId, router, queryClient]);

  if (isQueueStateLoading || !queueState) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const inMatch = matchState === MatchState.IN_PROGRESS;
  const inQueue = queueState.inQueue;

  return (
    <div className="container mx-auto max-w-3xl py-6">
      {/* Queue Control Card */}
      <Card>
        <CardContent className="p-4">
          {inMatch
            ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <Spinner size="xl" className="text-primary" />
                  <div className="text-center">
                    <p className="text-lg font-semibold">Match in progress</p>
                    <p className="text-sm text-muted-foreground">
                      You&apos;ll be redirected when the match finishes.
                    </p>
                  </div>
                </div>
              )
            : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Swords className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="mb-1 font-semibold">{props.team.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge
                          variant={inQueue ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {inQueue ? "In Queue" : "Idle"}
                        </Badge>
                        {inQueue && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {queueState.queueCount}
                            {" "}
                            waiting
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {inQueue
                    ? (
                        <Button
                          variant="destructive"
                          disabled={leaveQueueMutation.isPending}
                          onClick={() => leaveQueueMutation.mutate()}
                        >
                          {leaveQueueMutation.isPending
                            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            : <LogOut className="mr-2 h-4 w-4" />}
                          Leave Queue
                        </Button>
                      )
                    : (
                        <Button
                          disabled={joinQueueMutation.isPending}
                          onClick={() => joinQueueMutation.mutate()}
                        >
                          {joinQueueMutation.isPending
                            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            : <LogIn className="mr-2 h-4 w-4" />}
                          Join Queue
                        </Button>
                      )}
                </div>
              )}
          <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
            Join the queue to get matched against other teams. Matches start automatically once enough players are waiting.
          </p>
        </CardContent>
      </Card>

      {/* Match History */}
      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Past Matches</h2>
        <QueueMatchesList eventId={props.eventId} matches={queueMatches} />
      </div>
    </div>
  );
}
