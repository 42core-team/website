import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getTeamsForEventTable } from "@/app/actions/team";
import TeamsSearchBar from "./TeamsSearchBar";
import TeamsTable from "./TeamsTable";
import { Metadata } from "next/dist/lib/metadata/types/metadata-interface";

type TeamsPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export const metadata: Metadata = {
  title: "Teams",
  description: "Browse and join teams for this event in CORE Game.",
};

export default async function TeamsPage({
  params,
  searchParams,
}: TeamsPageProps) {
  const eventId = (await params).id;
  const searchParamsObj = await searchParams;
  if (!eventId || !searchParamsObj) return notFound();

  // Get filter/sort from query params
  const filterValue =
    typeof searchParamsObj?.q === "string" ? searchParamsObj.q : "";
  const allowedSortColumns = [
    "name",
    "createdAt",
    "membersCount",
    "queueScore",
  ] as const;
  const sortColumn =
    typeof searchParamsObj?.sort === "string" &&
    allowedSortColumns.includes(searchParamsObj.sort as any)
      ? (searchParamsObj.sort as
          | "name"
          | "createdAt"
          | "membersCount"
          | "queueScore")
      : "name";
  // Map "ascending"/"descending" to "asc"/"desc"
  let sortDirection: "asc" | "desc" | undefined;
  if (typeof searchParamsObj?.dir === "string") {
    if (searchParamsObj.dir === "ascending") sortDirection = "asc";
    else if (searchParamsObj.dir === "descending") sortDirection = "desc";
    else sortDirection = undefined;
  } else {
    sortDirection = "asc";
  }

  // Fetch teams server-side
  const teams = await getTeamsForEventTable(
    eventId,
    filterValue,
    sortColumn,
    sortDirection
  );

  return (
    <div className="py-3 space-y-8">
      <Card className="px-5 py-4">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Teams</h1>
            <TeamsSearchBar initialValue={filterValue} />
          </div>
          <TeamsTable teams={teams} eventId={eventId} />
        </div>
      </Card>
    </div>
  );
}
