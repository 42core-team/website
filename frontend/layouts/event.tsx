import { getServerSession } from "next-auth";
import React from "react";
import { isActionError } from "@/app/actions/errors";
import {
  getEventById,
  isEventAdmin,
  isUserRegisteredForEvent,
  shouldShowJoinNotice,
} from "@/app/actions/event";
import { authOptions } from "@/app/utils/authOptions";
import EventJoinNotice from "@/components/event-join-notice";
import EventNavbar from "@/components/event-navbar";

export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const eventId = params.id;
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <div className="container mx-auto max-w-7xl px-6 py-12">
        <div className="text-center p-8 shadow-xs">
          <h2 className="text-2xl font-semibold  mb-2">
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
  const showJoinNotice = await shouldShowJoinNotice(eventId);

  if (isActionError(isEventAdminState) || isActionError(isUserRegistered)) {
    throw new Error("Error: Unable to fetch event details");
  }

  if (!event) {
    throw new Error("Error: Unable to fetch event details");
  }

  return (
    <div className="relative flex flex-col min-h-lvh">
      {showJoinNotice && userId && (
        <EventJoinNotice
          eventId={eventId}
          userId={userId}
          startDate={event.startDate}
        />
      )}
      <EventNavbar
        event={event}
        eventId={eventId}
        isUserRegistered={isUserRegistered}
        isEventAdmin={isEventAdminState}
      />
      <main className="container mx-auto max-w-7xl px-6 grow">{children}</main>
    </div>
  );
}
