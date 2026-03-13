import type { Metadata } from "next/dist/lib/metadata/types/metadata-interface";
import { Suspense } from "react";
import { DashboardPage } from "./dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Admin dashboard for managing the event in CORE Game.",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const eventId = (await params).id;

  return (
    <Suspense fallback={<div>Loading dashboard...</div>}>
      <DashboardPage eventId={eventId} />
    </Suspense>
  );
}
