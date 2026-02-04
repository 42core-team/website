import { isActionError } from "@/app/actions/errors";
import { isEventAdmin } from "@/app/actions/event";
import { getSwissMatches } from "@/app/actions/tournament";
import Actions from "@/app/events/[id]/groups/actions";
import GraphView from "@/app/events/[id]/groups/graphView";

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
  searchParams: Promise<{ adminReveal?: string }>;
}) {
  const eventId = (await params).id;
  const isAdminView = (await searchParams).adminReveal === "true";
  const matches = await getSwissMatches(eventId, isAdminView);
  const eventAdmin = await isEventAdmin(eventId);
  if (isActionError(eventAdmin)) {
    throw new Error("Failed to verify admin status");
  }

  return (
    <div className="flex flex-col gap-4 md:gap-8">
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

      <div className="rounded-xl md:rounded-2xl border bg-card/50 text-card-foreground shadow-sm overflow-hidden h-[60vh] md:h-[75vh] min-h-[400px] md:min-h-[600px] relative">
        <GraphView
          matches={matches}
          eventAdmin={eventAdmin}
          isAdminView={isAdminView}
        />
      </div>
    </div>
  );
}
