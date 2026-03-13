"use client";

import type { Event } from "@/app/actions/event";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function EventsTable({ events }: Readonly<{ events: Event[] }>) {
  const router = useRouter();

  const formatState = (
    event: Event,
  ): {
    text: string;
    variant: "default" | "secondary" | "destructive";
  } => {
    const hasStarted = Date.now() >= new Date(event.startDate).getTime();

    if (!hasStarted) {
      return {
        text: "Team finding",
        variant: "default",
      };
    }

    if (event.currentRound === 0) {
      return {
        text: "In Progress",
        variant: "secondary",
      };
    }

    return {
      text: "Completed",
      variant: "destructive",
    };
  };

  return (
    <div className="mb-8">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead>Team Size</TableHead>
            <TableHead>State</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length === 0
            ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    No events found
                  </TableCell>
                </TableRow>
              )
            : (
                events.map(event => (
                  <TableRow
                    key={event.id}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => router.push(`/events/${event.id}`)}
                  >
                    <TableCell className="font-medium">{event.name}</TableCell>
                    <TableCell>
                      {new Date(event.startDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {event.minTeamSize}
                      {" "}
                      -
                      {event.maxTeamSize}
                      {" "}
                      members
                    </TableCell>
                    <TableCell>
                      <Badge variant={formatState(event).variant}>
                        {formatState(event).text}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
        </TableBody>
      </Table>
    </div>
  );
}
