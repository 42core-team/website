import { isActionError } from "@/app/actions/errors";
import { isEventAdmin } from "@/app/actions/event";
import { getTeamsForEventTable } from "@/app/actions/team";
import {
  getSwissMatches,
  getTournamentTeamCount,
} from "@/app/actions/tournament";
import Actions from "@/app/events/[id]/groups/actions";
import GroupPhaseTabs from "@/app/events/[id]/groups/GroupPhaseTabs";

export const metadata = {
  title: "Group Phase",
  description:
    "In the group phase, teams compete using the Swiss tournament system, with rankings determined by the Buchholz scoring system.",
};

export default async function page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ adminReveal?: string; tab?: string }>;
}) {
  const eventId = (await params).id;
  const isAdminView = (await searchParams).adminReveal === "true";
  const [matches, eventAdmin, teams, advancementCount] = await Promise.all([
    getSwissMatches(eventId, isAdminView),
    isEventAdmin(eventId),
    getTeamsForEventTable(eventId, undefined, "score", "desc", isAdminView),
    getTournamentTeamCount(eventId),
  ]);

  if (isActionError(eventAdmin)) {
    throw new Error("Failed to verify admin status");
  }

  return (
    <div className="flex flex-col gap-4 md:gap-8 pb-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5 md:space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Group Phase
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-3xl leading-relaxed">
            In the group phase, teams compete using the Swiss tournament system,
            with rankings determined by the Buchholz scoring system.
          </p>
        </div>
        {eventAdmin && (
          <div className="flex-shrink-0">
            <Actions />
          </div>
        )}
      </div>

      <GroupPhaseTabs
        eventId={eventId}
        matches={matches}
        teams={teams}
        eventAdmin={eventAdmin}
        isAdminView={isAdminView}
        advancementCount={advancementCount}
      />
    </div>
  );
}
