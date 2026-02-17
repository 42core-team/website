import { getServerSession } from "next-auth";
import React from "react";
import { isActionError } from "@/app/actions/errors";
import {
  getEventById,
  isEventAdmin,
  isUserRegisteredForEvent,
} from "@/app/actions/event";
import { authOptions } from "@/app/utils/authOptions";
import EventInfoNotice from "@/components/event-info-notice";
import EventNavbar from "@/components/event-navbar";

export default async function EventLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: { id: string };
}>) {
  const eventId = params.id;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <div className="container mx-auto max-w-7xl px-6 py-12">
        <div className="p-8 text-center shadow-xs">
          <h2 className="mb-2 text-2xl  font-semibold">
            Authentication Required
          </h2>
          <p className="text-gray-300">Please sign in to view this event</p>
        </div>
      </div>
    );
  }

  const event = await getEventById(eventId);
  if (isActionError(event))
    throw new Error(`Could not get Event: ${event.error}`);

  const isEventAdminState = await isEventAdmin(eventId);
  const isUserRegistered = await isUserRegisteredForEvent(eventId);

  if (isActionError(isEventAdminState) || isActionError(isUserRegistered)) {
    throw new Error("Error: Unable to fetch event details");
  }

  if (!event) {
    throw new Error("Error: Unable to fetch event details");
  }

  return (
    <div className="relative flex min-h-lvh flex-col">
      {userId && (
        <EventInfoNotice userId={userId} startDate={event.startDate} />
      )}
      <EventNavbar
        event={event}
        eventId={eventId}
        isUserRegistered={isUserRegistered}
        isEventAdmin={isEventAdminState}
      />
      <main className="container mx-auto max-w-7xl grow px-6">{children}</main>
    </div>
  );
}
