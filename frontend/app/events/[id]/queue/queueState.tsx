"use client";
import { useEffect, useRef, useState } from "react";
import { Button, cn } from "@heroui/react";
// @ts-ignore
import { QueueState } from "@/app/actions/team.model";
import { getQueueState, joinQueue, leaveQueue, Team } from "@/app/actions/team";
import { MatchState, Match } from "@/app/actions/tournament-model";
import { Spinner } from "@heroui/spinner";
import QueueMatchesList from "@/components/QueueMatchesList";
import { useParams, useRouter } from "next/navigation";
import { usePlausible } from "next-plausible";

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

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const stateRef = useRef(queueState);
    stateRef.current = queueState;

    const shouldPoll = (s: QueueState) =>
        !!s.inQueue || s.match?.state === MatchState.IN_PROGRESS;

    const startPolling = () => {
        if (intervalRef.current) return;
        intervalRef.current = setInterval(fetchQueueState, 600);
    };

    const stopPolling = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    async function fetchQueueState() {
        const newQueueState = await getQueueState(eventId);
        const prev = stateRef.current;
        const wasInProgress = prev.match?.state === MatchState.IN_PROGRESS;
        const isInProgress = newQueueState.match?.state === MatchState.IN_PROGRESS;

        if (wasInProgress && !isInProgress && newQueueState.match) {
            router.push(`/events/${eventId}/match/${newQueueState.match.id}`);
        }

        setQueueState(newQueueState);
    }

    useEffect(() => {
        if (shouldPoll(queueState)) startPolling();
        else stopPolling();

        return () => stopPolling();
    }, [queueState.inQueue, queueState.match?.state]);

    useEffect(() => {
        setQueueState(props.queueState);
    }, [props.queueState]);

    const handleToggleQueue = async () => {
        setJoiningQueue(true);

        if (!queueState.inQueue) {
            plausible("join_queue");
            await joinQueue(eventId);
            setQueueState((s) => ({
                ...s,
                inQueue: true,
                queueCount: s.queueCount + 1,
            }));
        } else {
            plausible("leave_queue");
            if (typeof leaveQueue === "function") {
                await leaveQueue(eventId);
            }
            setQueueState((s) => ({
                ...s,
                inQueue: false,
                queueCount: Math.max(s.queueCount - 1, 0),
            }));
        }

        setJoiningQueue(false);
    };

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
                                "text-sm text-default-500",
                                queueState.inQueue ? "text-green-500" : ""
                            )}
                        >
                            Status: {queueState.inQueue ? "In Queue" : "Not in Queue"}
                        </p>

                        <Button
                            isDisabled={joiningQueue}
                            onPress={handleToggleQueue}
                            color={queueState.inQueue ? "danger" : "success"}
                        >
                            {queueState.inQueue ? "Leave Queue" : "Join Queue"}
                        </Button>

            {queueState.inQueue && (
                <p className="text-sm">Queue Count: {queueState.queueCount}</p>
            )}
          </>
        )}
      </div>
            <div className="mt-8 w-full max-w-2xl">
                <h2 className="mb-4 text-xl font-semibold">Past Matches</h2>
                <QueueMatchesList eventId={eventId} matches={props.queueMatches} />
            </div>
        </div>
    );
}
