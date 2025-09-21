import HomePageClient from "@/components/HomePageClient";
import { getGlobalStats } from "@/app/actions/stats";
import { getCurrentLiveEvent } from "@/app/actions/event";
import { isActionError } from "@/app/actions/errors";

export default async function HomePage() {
  const globalStats = await getGlobalStats();
  const currentLiveEvent = await getCurrentLiveEvent();
  if (isActionError(currentLiveEvent)) {
    console.log(currentLiveEvent);
    throw new Error("Failed to load current live event");
  }

  return (
    <HomePageClient
      initialStats={globalStats}
      currentLiveEvent={currentLiveEvent}
    />
  );
}
