"use client";
import type { OnChangeFn, SortingState } from "@tanstack/react-table";
import type { Team } from "@/app/actions/team";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TeamsTableProps {
  teams: Team[];
  eventId: string;
}

export default function TeamsTable({ teams, eventId }: TeamsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const sorting = useMemo<SortingState>(() => {
    const sort = searchParams.get("sort") || "name";
    const dir = searchParams.get("dir") || "ascending";
    return [{ id: sort, desc: dir === "descending" }];
  }, [searchParams]);

  const onSortingChange: OnChangeFn<SortingState> = (updaterOrValue) => {
    const newSorting
      = typeof updaterOrValue === "function"
        ? updaterOrValue(sorting)
        : updaterOrValue;

    const params = new URLSearchParams(searchParams.toString());
    if (newSorting.length > 0) {
      params.set("sort", newSorting[0].id);
      params.set("dir", newSorting[0].desc ? "descending" : "ascending");
    }
    else {
      params.delete("sort");
      params.delete("dir");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

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
    onSortingChange,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {table.getHeaderGroups()[0].headers.map(header => (
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
        {table.getRowModel().rows.length === 0
          ? (
              <TableRow>
                <TableCell colSpan={columns.length}>No teams found</TableCell>
              </TableRow>
            )
          : (
              table.getRowModel().rows.map(row => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() =>
                    router.push(`/events/${eventId}/teams/${row.original.id}`)}
                >
                  {row.getVisibleCells().map(cell => (
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
