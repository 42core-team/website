import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import {
  canUserCreateEvent,
  getEvents,
  getMyEvents,
} from "@/app/actions/event";
import EventsTabs from "@/app/events/EventsTabs";
import { authOptions } from "@/app/utils/authOptions";
import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Events",
  description: "Browse, join, and create events in CORE Game.",
  openGraph: {
    title: "Events",
    description: "Browse, join, and create events in CORE Game.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Events",
    description: "Browse, join, and create events in CORE Game.",
  },
};

async function getData() {
  const [allEvents, myEvents, canCreate] = await Promise.all([
    getEvents(),
    getMyEvents(),
    canUserCreateEvent(),
  ]);

  return { allEvents, myEvents, canCreate };
}

export default async function EventsPage() {
  const { allEvents, myEvents, canCreate } = await getData();
  const session = await getServerSession(authOptions);

  return (
    <>
      <div className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div className="flex flex-row items-center justify-center">
          <h1 className={title()}>Events</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Discover and join upcoming coding competitions
        </p>
        {canCreate && (
          <Link href="/events/create">
            <Button color="primary">Create Event</Button>
          </Link>
        )}
      </div>
      <div className="mt-8">
        <EventsTabs
          myEvents={myEvents}
          allEvents={allEvents}
          isLoggedIn={session != null}
        />
      </div>
    </>
  );
}
