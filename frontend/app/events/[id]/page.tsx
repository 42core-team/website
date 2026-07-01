import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
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
        <CardTitle className="mb-2 text-lg font-semibold">{title}</CardTitle>
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
      <div className="flex min-h-50 items-center justify-center">
        <p>No event data found</p>
      </div>
    );
  }

  const teamsCount = await getTeamsCountForEvent(id);
  const participantsCount = await getParticipantsCountForEvent(id);

  const renderedDescription = String(
    await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeSanitize)
      .use(rehypeStringify)
      .process(event.description || ""),
  );
  const image = event.gameServerDockerImage?.split("@")[0] || "";
  const imageTagIndex = image.lastIndexOf(":");
  const imageTag = imageTagIndex > image.lastIndexOf("/")
    ? image.slice(imageTagIndex + 1)
    : "Unknown";
  let worldGenerator = "Unknown";

  try {
    const parsedGameConfig = JSON.parse(event.gameConfig || "{}") as {
      worldGenerator?: unknown;
    };

    if (typeof parsedGameConfig.worldGenerator === "string") {
      worldGenerator = parsedGameConfig.worldGenerator
        .replace(/_/g, " ")
        .replace(/([A-Z])/g, " $1")
        .replace(/\b\w/g, letter => letter.toUpperCase())
        .trim();
    }
  }
  catch {}

  return (
    <div className="container mx-auto py-4">
      <h1 className="mb-8 text-3xl font-bold">{event.name}</h1>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
              className="prose mt-1 max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: renderedDescription }}
            >
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Team Size
              </h3>
              <p className="mt-1">
                {event.minTeamSize}
                {" "}
                -
                {" "}
                {event.maxTeamSize}
                {" "}
                members
              </p>
            </div>
            {event.repoLockDate && (
              <RepoLockCountdown repoLockDate={event.repoLockDate} />
            )}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                Version
              </h3>
              <p className="mt-1">{imageTag}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">
                World Generator
              </h3>
              <p className="mt-1">{worldGenerator}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
