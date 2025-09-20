import { Metadata } from "next";
import { getQueueMatchesAdmin } from "@/app/actions/team";
import { isActionError } from "@/app/actions/errors";
import { isEventAdmin } from "@/app/actions/event";
import QueueMatchesList from "@/components/QueueMatchesList";
import QueueMatchesChart from "@/components/QueueMatchesChart";
import { getQueueMatchesTimeSeries } from "@/app/actions/stats";
import QueueMatchesControls from "@/components/QueueMatchesControls";

export const metadata: Metadata = {
  title: "Queue Matches",
  description: "List of all queue matches for this event (admins only)",
};

function toISO(d: Date) {
  return new Date(d).toISOString();
}

function formatDateShort(d: Date) {
  return d.toLocaleDateString();
}

export default async function EventQueueMatchesAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string; end?: string; interval?: string }>;
}) {
  const { id } = await params;

  const admin = await isEventAdmin(id);
  if (isActionError(admin) || !admin) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  const sp = await searchParams;
  const rawInterval = (sp.interval || "hour").toLowerCase();
  const interval: "minute" | "hour" | "day" =
    rawInterval === "minute" || rawInterval === "hour" || rawInterval === "day"
      ? (rawInterval as any)
      : "hour";

  const now = new Date();
  const defaultStart = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const startISO = sp.start || toISO(defaultStart);
  const endISO = sp.end || toISO(now);

  let startDate = new Date(startISO);
  let endDate = new Date(endISO);

  if (startDate > endDate) {
    const tmp = startDate;
    startDate = endDate;
    endDate = tmp;
  }

  const [matches, series] = await Promise.all([
    getQueueMatchesAdmin(id),
    getQueueMatchesTimeSeries(
      id,
      interval,
      startDate.toISOString(),
      endDate.toISOString(),
    ),
  ]);

  const chartTitle = `Matches played (${formatDateShort(startDate)} – ${formatDateShort(endDate)}, ${interval} buckets)`;

  return (
    <div className="container mx-auto py-3">
      <h1 className="text-3xl font-bold mb-8">All Queue Matches</h1>

      <div className="mb-6">
        <QueueMatchesControls
          initialInterval={interval}
          initialStartISO={startDate.toISOString()}
          initialEndISO={endDate.toISOString()}
        />
      </div>

      <div className="mb-10">
        <h2 className="text-xl font-semibold mb-4">{chartTitle}</h2>
        <QueueMatchesChart data={series} title={chartTitle} />
      </div>

      <QueueMatchesList eventId={id} matches={matches} />
    </div>
  );
}
