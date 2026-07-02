import { redirect } from "next/navigation";
import { isActionError } from "@/app/actions/errors";
import { getEventById, isUserRegisteredForEvent } from "@/app/actions/event";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { readComponentsConfig } from "./config";
import UnitBuilder from "./UnitBuilder";

export const metadata = {
  title: "Unit Builder",
  description: "Build a CORE Game unit from the event component rules.",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isRegistered = await isUserRegisteredForEvent(id);

  if (isActionError(isRegistered) || !isRegistered)
    redirect(`/events/${id}`);

  const event = await getEventById(id);
  if (isActionError(event))
    redirect(`/events/${id}`);

  if (new Date(event.startDate).getTime() > Date.now())
    redirect(`/events/${id}`);

  const config = readComponentsConfig(event.gameConfig);

  if (!config) {
    return (
      <div className="mx-auto mt-3 mb-8 max-w-4xl">
        <Alert variant="destructive">
          <AlertTitle>Unit builder unavailable</AlertTitle>
          <AlertDescription>
            This event does not expose a valid component config.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <UnitBuilder config={config} />;
}
