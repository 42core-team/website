import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import { isActionError } from "@/app/actions/errors";
import {
  getEventById,
  getParticipantsCountForEvent,
  getTeamsCountForEvent,
} from "@/app/actions/event";
import RepoLockCountdown from "@/app/events/[id]/repoLockCountdown";
import TimeBadge from "@/components/timeBadge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function StatCard({
  title,
  value,
  className = "",
}: {
  title: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`${className}`}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold mb-2">{title}</CardTitle>
        <CardDescription className="text-3xl font-bold">
          {value}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const event = await getEventById(id);
  if (isActionError(event)) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p>No event data found</p>
      </div>
    );
  }

  const teamsCount = await getTeamsCountForEvent(id);
  const participantsCount = await getParticipantsCountForEvent(id);

  const renderedDescription = String(
    await remark()
      .use(remarkGfm)
      .use(remarkHtml)
      .process(event.description || ""),
  );

  return (
    <div className="container mx-auto py-4">
      <h1 className="text-3xl font-bold mb-8">{event.name}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard title="Participants" value={participantsCount} />
        <StatCard title="Teams" value={teamsCount} />
        <StatCard title="Location" value={event.location || "TBA"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Event Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">
              Description
            </h3>
            <div
              className="prose dark:prose-invert max-w-none mt-1"
              dangerouslySetInnerHTML={{ __html: renderedDescription }}
            ></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Start Date
              </h3>
              <TimeBadge className="mt-1" time={event.startDate} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                End Date
              </h3>
              <TimeBadge className="mt-1" time={event.endDate} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Team Size
              </h3>
              <p className="mt-1">
                {event.minTeamSize} - {event.maxTeamSize} members
              </p>
            </div>
            {event.repoLockDate && (
              <RepoLockCountdown repoLockDate={event.repoLockDate} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
