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
    <div className="flex flex-col gap-4 md:gap-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5 md:space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Tournament Tree
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-3xl leading-relaxed">
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

      <div className="rounded-xl md:rounded-2xl border bg-card/50 text-card-foreground shadow-sm overflow-hidden h-[60vh] md:h-[75vh] min-h-[400px] md:min-h-[600px] relative">
        <GraphView
          matches={serializedMatches}
          teamCount={teamCount}
          isEventAdmin={eventAdmin}
          isAdminView={isAdminView}
        />
      </div>
    </div>
  );
}
