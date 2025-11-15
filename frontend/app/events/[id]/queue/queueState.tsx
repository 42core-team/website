"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
// @ts-ignore
import { QueueState } from "@/app/actions/team.model";
import { getQueueState, joinQueue, Team } from "@/app/actions/team";
import { Match, MatchState } from "@/app/actions/tournament-model";
import { Spinner } from "@/components/ui/spinner";
import QueueMatchesList from "@/components/QueueMatchesList";
import { useParams, useRouter } from "next/navigation";
import { usePlausible } from "next-plausible";
import { cn } from "@/lib/utils";

export default function QueueState(props: {
  queueState: QueueState;
  eventId: string;
  team: Team;
  queueMatches: Match[];
}) {
  const plausible = usePlausible();

  const [queueState, setQueueState] = useState<QueueState>(props.queueState);
  const [joiningQueue, setJoiningQueue] = useState(false);

  const router = useRouter();
  const { id } = useParams();
  const eventId = id as string;

  useEffect(() => {
    async function fetchQueueState() {
      const newQueueState = await getQueueState(props.eventId);
      if (
        queueState.match?.state === MatchState.IN_PROGRESS &&
        newQueueState.match?.state !== MatchState.IN_PROGRESS
      ) {
        if (newQueueState.match) {
          router.push(`/events/${eventId}/match/${newQueueState?.match?.id}`);
        }
      }
      setQueueState(newQueueState);
    }

    const interval = setInterval(fetchQueueState, 600);
    return () => clearInterval(interval);
  });

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <h1 className="text-2xl font-bold">Queue State</h1>
      <div className="mt-4 flex flex-col items-center justify-center gap-2">
        {queueState?.match?.state === MatchState.IN_PROGRESS ? (
          <Spinner color="success" />
        ) : (
          <>
            <p className="text-lg">Team: {props.team.name}</p>
            <p
              className={cn(
                "text-sm text-muted-foreground",
                queueState.inQueue ? "text-green-500" : ""
              )}
            >
              Status: {queueState.inQueue ? "In Queue" : "Not in Queue"}
            </p>
            {!queueState.inQueue ? (
              <Button
                disabled={joiningQueue}
                onClick={() => {
                  setJoiningQueue(true);
                  plausible("join_queue");
                  joinQueue(props.eventId)
                    .then(() => {
                      setQueueState({
                        ...queueState,
                        inQueue: true,
                        queueCount: queueState.queueCount + 1,
                      });
                    })
                    .finally(() => {
                      setJoiningQueue(false);
                    });
                }}
              >
                play
              </Button>
            ) : (
              <>
                <p className="text-sm">Queue Count: {queueState.queueCount}</p>
              </>
            )}
          </>
        )}
      </div>

      <div className="mt-8 w-full max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold">Past Matches</h2>
        <QueueMatchesList
          eventId={props.eventId}
          matches={props.queueMatches}
        />
      </div>
    </div>
  );
}
