"use client";

import type { Event } from "@/app/actions/event";
import { useRouter } from "next/navigation";

import { EventState } from "@/app/actions/event-model";
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

  const formatState = (state: EventState) => {
    switch (state) {
      case EventState.TEAM_FINDING:
        return "Team Finding";
      case EventState.CODING_PHASE:
        return "Coding Phase";
      case EventState.SWISS_ROUND:
        return "Swiss Round";
      case EventState.ELIMINATION_ROUND:
        return "Elimination Round";
      case EventState.FINISHED:
        return "Finished";
      default:
        return state;
    }
  };

  const stateVariant = (
    state: EventState,
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (state) {
      case EventState.TEAM_FINDING:
        return "default";
      case EventState.CODING_PHASE:
        return "secondary";
      case EventState.SWISS_ROUND:
        return "outline";
      case EventState.ELIMINATION_ROUND:
        return "outline";
      case EventState.FINISHED:
        return "secondary";
      default:
        return "default";
    }
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
                      <Badge variant={stateVariant(event.state)}>
                        {formatState(event.state)}
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
