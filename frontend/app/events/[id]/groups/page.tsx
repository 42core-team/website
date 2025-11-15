import Actions from "@/app/events/[id]/groups/actions";
import { getSwissMatches } from "@/app/actions/tournament";
import GraphView from "@/app/events/[id]/groups/graphView";
import { isEventAdmin } from "@/app/actions/event";
import { isActionError } from "@/app/actions/errors";

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
    <div>
      <div className="flex gap-2">
        <Actions />
      </div>
      <h1>Group phase</h1>
      <p>
        In the group phase, teams compete using the Swiss tournament system,
        with rankings determined by the Buchholz scoring system.
      </p>
      <GraphView
        matches={matches}
        eventAdmin={eventAdmin}
        isAdminView={isAdminView}
      />
    </div>
  );
}
