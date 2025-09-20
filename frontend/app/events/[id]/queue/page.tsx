import QueueState from "@/app/events/[id]/queue/queueState";
import {
  getMyEventTeam,
  getQueueMatches,
  getQueueState,
} from "@/app/actions/team";
import { Metadata } from "next/dist/lib/metadata/types/metadata-interface";

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
      <div className="flex items-center justify-center min-h-[200px]">
        <p>You are not part of any team for this event.</p>
      </div>
    );
  }

  const queueState = await getQueueState(id);
  let queueMatches = await getQueueMatches(id);

  queueMatches = queueMatches.map((match) => {
    return {
      ...match,
      teams: match.teams.sort((a, b) => (a.id === myTeam.id ? -1 : 1)),
    };
  });

  return (
    <div className="container mx-auto py-3">
      <h1 className="text-3xl font-bold mb-8">Event Queue</h1>
      <p className="text-lg text-default-600 mb-4">
        Play against other participants in the queue to test your code.
      </p>
      <p className="text-sm text-default-500">
        If you have any questions, please contact the event organizers.
      </p>

      {!myTeam.locked ? (
        <div className="mt-8">
          <QueueState
            queueState={queueState}
            eventId={id}
            team={myTeam}
            queueMatches={queueMatches}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center min-h-[200px]">
          <p className="text-lg text-default-500">
            Your team is locked and cannot join the queue.
          </p>
        </div>
      )}
    </div>
  );
}
