import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { canUserCreateEvent } from "@/app/actions/event";
import { authOptions } from "@/app/utils/authOptions";
import { title } from "@/components/primitives";
import CreateEventForm from "./CreateEventForm";

export const metadata: Metadata = {
  title: "Create Event",
};

export default async function CreateEventPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/events");
  }

  const hasPermission = await canUserCreateEvent();
  if (!hasPermission) {
    redirect("/events");
  }

  return (
    <div className="container mx-auto py-3 max-w-3xl min-h-lvh">
      <div className="flex flex-col items-center justify-center gap-4 py-8 md:py-6 mb-8">
        <h1 className={title()}>Create New Event</h1>
      </div>

      <CreateEventForm />
    </div>
  );
}
