import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { getCurrentLiveEvent } from "@/app/actions/event";
import { isActionError } from "@/app/actions/errors";
import HomePageClient from "@/components/HomePageClient";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/")({
  component: HomeRoute,
});

function HomeRoute() {
  const currentEventQuery = useQuery({
    queryKey: ["events", "current-live"],
    queryFn: async () => {
      const response = await getCurrentLiveEvent();
      if (isActionError(response)) {
        throw new Error(response.error);
      }
      return response;
    },
  });

  if (currentEventQuery.isPending) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </main>
    );
  }

  if (currentEventQuery.isError) {
    return (
      <main className="container mx-auto px-4 py-16">
        <p className="text-center text-destructive">
          Failed to load the CORE dashboard.
        </p>
      </main>
    );
  }

  return (
    <main className="py-8">
      <HomePageClient
        currentLiveEvent={currentEventQuery.data}
      />
    </main>
  );
}
