"use client";
import type { SortingState } from "@tanstack/react-table";
import type { Team } from "@/app/actions/team";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ...existing code...
interface TeamsTableProps {
  teams: Team[];
  eventId: string;
}

export default function TeamsTable({ teams, eventId }: TeamsTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);

  const columns = [
    {
      accessorKey: "name",
      header: "Name",
      cell: (info: any) => info.getValue(),
    },
    {
      accessorKey: "membersCount",
      header: "Members",
      cell: (info: any) => info.getValue(),
    },
    {
      accessorKey: "queueScore",
      header: "Queue Score",
      cell: (info: any) => info.getValue() || 0,
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: (info: any) =>
        info.getValue()
          ? new Date(info.getValue()).toLocaleDateString()
          : "N/A",
    },
  ];

  const table = useReactTable({
    data: teams,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {table.getHeaderGroups()[0].headers.map((header) => (
            <TableHead
              key={header.id}
              onClick={header.column.getToggleSortingHandler()}
              className="cursor-pointer select-none"
            >
              {flexRender(header.column.columnDef.header, header.getContext())}
              {header.column.getIsSorted() === "asc" && " ▲"}
              {header.column.getIsSorted() === "desc" && " ▼"}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length}>No teams found</TableCell>
          </TableRow>
        ) : (
          table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() =>
                router.push(`/events/${eventId}/teams/${row.original.id}`)
              }
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
