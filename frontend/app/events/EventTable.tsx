"use client";

import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Chip,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { Event } from "@/app/actions/event";
import { EventState } from "@/app/actions/event-model";

export default function EventsTable({ events }: { events: Event[] }) {
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

  const stateColor = (
    state: EventState,
  ): "default" | "primary" | "secondary" | "success" | "warning" | "danger" => {
    switch (state) {
      case EventState.TEAM_FINDING:
        return "primary";
      case EventState.CODING_PHASE:
        return "secondary";
      case EventState.SWISS_ROUND:
        return "warning";
      case EventState.ELIMINATION_ROUND:
        return "warning";
      case EventState.FINISHED:
        return "success";
      default:
        return "default";
    }
  };

  return (
    <Table
      aria-label="Events table"
      className="mb-8"
      onRowAction={(key) => router.push(`/events/${String(key)}`)}
    >
      <TableHeader>
        <TableColumn>Name</TableColumn>
        <TableColumn>Start Date</TableColumn>
        <TableColumn>Team Size</TableColumn>
        <TableColumn>State</TableColumn>
      </TableHeader>
      <TableBody items={events} emptyContent="No events found">
        {(event) => (
          <TableRow
            key={event.id}
            className="cursor-pointer transition-colors hover:bg-default-100"
          >
            <TableCell>{event.name}</TableCell>
            <TableCell>
              {new Date(event.startDate).toLocaleDateString()}
            </TableCell>
            <TableCell>
              {event.minTeamSize} - {event.maxTeamSize} members
            </TableCell>
            <TableCell>
              <Chip size="sm" variant="flat" color={stateColor(event.state)}>
                {formatState(event.state)}
              </Chip>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
