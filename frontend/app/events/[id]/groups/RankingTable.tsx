"use client";

import type { Team } from "@/app/actions/team";
import type { Match } from "@/app/actions/tournament-model";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Fragment } from "react";

interface RankingTableProps {
  teams: Team[];
  matches: Match[];
  eventId: string;
  advancementCount: number;
}

export default function RankingTable({
  teams,
  matches,
  eventId,
  advancementCount,
}: RankingTableProps) {
  // Sort teams by score (desc), then buchholzPoints (desc)
  const sortedTeams = [...teams].sort((a, b) => {
    const scoreA = a.score ?? 0;
    const scoreB = b.score ?? 0;
    const buchholzA = a.buchholzPoints ?? 0;
    const buchholzB = b.buchholzPoints ?? 0;

    if (scoreB !== scoreA) return scoreB - scoreA;
    return buchholzB - buchholzA;
  });

  const getMatchHistory = (teamId: string) => {
    return matches
      .filter(
        (m) => m.state === "FINISHED" && m.teams.some((t) => t.id === teamId),
      )
      .sort((a, b) => a.round - b.round)
      .map((m) => {
        if (!m.winner) return "T"; // Tie (not really possible in currently implemented swiss but good for safety)
        return m.winner.id === teamId ? "W" : "L";
      });
  };

  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-border/50">
            <TableHead className="w-[80px]">Rank</TableHead>
            <TableHead>Participant</TableHead>
            <TableHead className="text-center">Score</TableHead>
            <TableHead className="text-center">Buchholz</TableHead>
            <TableHead className="text-center">Byes</TableHead>
            <TableHead className="text-right">Match History</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTeams.map((team, index) => {
            const rank = index + 1;
            const history = getMatchHistory(team.id);
            const isAtCutoff = rank === advancementCount;

            return (
              <Fragment key={team.id}>
                <TableRow className="group hover:bg-muted/30 transition-colors border-b border-border/40">
                  <TableCell className="font-medium text-muted-foreground">
                    {rank}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/events/${eventId}/teams/${team.id}`}
                        className="font-semibold hover:text-primary transition-colors truncate max-w-[200px]"
                      >
                        {team.name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-bold">
                    {(team.score ?? 0).toFixed(1)}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {(team.buchholzPoints ?? 0).toFixed(1)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="font-mono">
                      {team.hadBye ? "+1.0" : "0"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {history.map((result, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold shadow-sm",
                            result === "W" && "bg-emerald-500 text-white",
                            result === "L" && "bg-destructive text-white",
                            result === "T" && "bg-muted-foreground text-white",
                          )}
                        >
                          {result}
                        </div>
                      ))}
                      {history.length === 0 && (
                        <span className="text-xs text-muted-foreground">
                          No matches
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                {isAtCutoff && index < sortedTeams.length - 1 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={6}
                      className="h-10 p-0 text-center align-middle"
                    >
                      <div className="flex items-center gap-4 px-4 w-full h-full">
                        <div className="h-px flex-1 bg-emerald-500/50" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/80">
                          Advancement Cutoff
                        </span>
                        <div className="h-px flex-1 bg-emerald-500/50" />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
