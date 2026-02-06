import type { Match } from "@/app/actions/tournament-model";
import { isActionError } from "@/app/actions/errors";
import { isEventAdmin } from "@/app/actions/event";
import {
  getTournamentMatches,
  getTournamentTeamCount,
} from "@/app/actions/tournament";
import Actions from "@/app/events/[id]/bracket/actions";
import GraphView from "@/app/events/[id]/bracket/graphView";

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
  const serializedMatches: Match[] = await getTournamentMatches(
    eventId,
    isAdminView,
  );
  const teamCount = await getTournamentTeamCount(eventId);

  return (
    <div>
      <div className="flex gap-2">
        <Actions />
      </div>
      <h1>Tournament Tree</h1>
      <p></p>
      <GraphView
        matches={serializedMatches}
        teamCount={teamCount}
        isEventAdmin={eventAdmin}
        isAdminView={isAdminView}
      />
    </div>
  );
}
