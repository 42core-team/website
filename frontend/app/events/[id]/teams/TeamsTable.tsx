"use client";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  SortDescriptor,
} from "@heroui/react";
import { Team } from "@/app/actions/team";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function TeamsTable({
  teams,
  eventId,
}: {
  teams: Team[];
  eventId: string;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "name",
    direction: "ascending",
  });

  const handleSortChange = (descriptor: SortDescriptor) => {
    setSortDescriptor(descriptor);
    const newSortColumn = String(descriptor.column);
    const newSortDirection = String(descriptor.direction);

    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", newSortColumn);
    params.set("dir", newSortDirection);
    router.replace(`?${params.toString()}`);
  };

  return (
    <Table
      aria-label="Teams table"
      onSortChange={handleSortChange}
      sortDescriptor={sortDescriptor}
    >
      <TableHeader>
        <TableColumn key="name" allowsSorting>
          Name
        </TableColumn>
        <TableColumn key="membersCount" allowsSorting>
          Members
        </TableColumn>
        <TableColumn key="queueScore" allowsSorting>
          Queue Score
        </TableColumn>
        <TableColumn key="createdAt" allowsSorting>
          Created
        </TableColumn>
      </TableHeader>
      <TableBody emptyContent="No teams found">
        {teams.map((team) => (
          <TableRow
            key={team.id}
            className="cursor-pointer hover:bg-default-100 transition-colors"
            onClick={() => router.push(`/events/${eventId}/teams/${team.id}`)}
          >
            <TableCell>{team.name}</TableCell>
            <TableCell>{team.membersCount}</TableCell>
            <TableCell>{team.queueScore || 0}</TableCell>
            <TableCell>
              {team.createdAt
                ? new Date(team.createdAt).toLocaleDateString()
                : "N/A"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
