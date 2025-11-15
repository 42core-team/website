"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EventsTable from "@/app/events/EventTable";
import { Event } from "@/app/actions/event";

export default function EventsTabs({
  myEvents,
  allEvents,
  isLoggedIn,
}: {
  myEvents: Event[];
  allEvents: Event[];
  isLoggedIn: boolean;
}) {
  if (!isLoggedIn) {
    return <EventsTable events={allEvents} />;
  }
  return (
    <Tabs
      defaultValue={myEvents.length ? "my" : "all"}
      className="w-full ps-1.5 pb-0.5"
    >
      <TabsList aria-label="Events tabs">
        <TabsTrigger value="my">{`My Events (${myEvents.length})`}</TabsTrigger>
        <TabsTrigger value="all">
          {`All Events (${allEvents.length})`}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="my">
        <EventsTable events={myEvents} />
      </TabsContent>
      <TabsContent value="all">
        <EventsTable events={allEvents} />
      </TabsContent>
    </Tabs>
  );
}
