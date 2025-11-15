"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Match, MatchState } from "@/app/actions/tournament-model";
import { cn } from "@/lib/utils";

export default function QueueMatchesList(props: {
  eventId: string;
  matches: Match[];
}) {
  const { eventId, matches } = props;

  if (!matches || matches.length === 0) {
    return (
      <p className="text-center text-muted-foreground">No past matches found</p>
    );
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto">
      {matches.map((match) => (
        <div
          key={match.id}
          className="rounded-lg border border-default-200 p-4 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Match ID: {match.id}
            </span>
            <span
              className={cn(
                "text-xs px-2 py-1 rounded-full",
                match.state === MatchState.FINISHED
                  ? "bg-success-100 text-success-700"
                  : match.state === MatchState.IN_PROGRESS
                    ? "bg-warning-100 text-warning-700"
                    : "bg-background text-foreground"
              )}
            >
              {match.state}
            </span>
          </div>

          <div className="mt-3 space-y-3">
            {match.results.length == 2 && (
              <div className="flex items-center justify-center gap-2">
                <div
                  className={cn(
                    "flex-1 text-center py-2 px-3 rounded-md",
                    match.winner?.name === match.teams[0]?.name
                      ? "bg-success-50 border border-success-200"
                      : ""
                  )}
                >
                  <div className="font-medium">
                    {match.teams[0]?.name || "Unknown Team"}
                    {match.winner?.id === match.teams[0]?.id && (
                      <span className="ml-2">👑</span>
                    )}
                  </div>
                  <div className="text-xl font-bold mt-1">
                    {match.results.find(
                      (result) => result.team?.id === match.teams[0]?.id
                    )?.score || 0}
                  </div>
                </div>

                <div className="text-muted-foreground font-bold">VS</div>

                <div
                  className={cn(
                    "flex-1 text-center py-2 px-3 rounded-md",
                    match.winner?.name === match.teams[1]?.name
                      ? "bg-success-50 border border-success-200"
                      : ""
                  )}
                >
                  <div className="font-medium">
                    {match.teams[1]?.name || "Unknown Team"}
                    {match.winner?.id === match.teams[1]?.id && (
                      <span className="ml-2">👑</span>
                    )}
                  </div>
                  <div className="text-xl font-bold mt-1">
                    {match.results.find(
                      (result) => result.team?.id === match.teams[1]?.id
                    )?.score || 0}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 text-xs text-muted-foreground flex justify-between items-center">
            <span>{new Date(match.createdAt).toLocaleString()}</span>
            <Link href={"/events/" + eventId + "/match/" + match.id}>
              <Button size="sm" color="secondary">
                Replay
              </Button>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
