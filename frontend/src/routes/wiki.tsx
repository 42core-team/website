import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/wiki")({
  component: WikiRoute,
});

function WikiRoute() {
  return (
    <main className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold">Wiki</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        The wiki route is ready in TanStack Router. The old Next API-backed wiki
        search and static markdown generation should be migrated separately to a
        client-side or backend-backed API endpoint.
      </p>
    </main>
  );
}
