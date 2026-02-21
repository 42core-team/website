"use client";

import type { Team } from "@/app/actions/team";
import type { Match } from "@/app/actions/tournament-model";
import { useRouter } from "next/navigation";
import { Fragment } from "react";
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
  const router = useRouter();

  // Sort teams by score (desc), then buchholzPoints (desc)
  const sortedTeams = [...teams].sort((a, b) => {
    if (b.score !== a.score)
      return b.score - a.score;
    return b.buchholzPoints - a.buchholzPoints;
  });

  const getMatchHistory = (teamId: string) => {
    return matches
      .filter(
        m => m.state === "FINISHED" && m.teams.some(t => t.id === teamId),
      )
      .sort((a, b) => a.round - b.round)
      .map((m) => {
        if (!m.winner)
          return { id: m.id, result: "T" };
        return {
          id: m.id,
          result: m.winner.id === teamId ? "W" : "L",
        };
      });
  };

  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
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
                <TableRow
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() =>
                    router.push(`/events/${eventId}/teams/${team.id}`)}
                >
                  <TableCell>{rank}</TableCell>
                  <TableCell>{team.name}</TableCell>
                  <TableCell className="text-center font-bold">
                    {(team.score ?? 0).toFixed(1)}
                  </TableCell>
                  <TableCell className="text-center">
                    {(team.buchholzPoints ?? 0).toFixed(1)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="font-mono">
                      {team.hadBye ? "+1.0" : "0"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {history.map((match, i) => (
                        <div
                          key={i}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/events/${eventId}/match/${match.id}`);
                          }}
                          className={cn(
                            "w-6 h-6 rounded flex items-center justify-center text-[11px] shadow-sm cursor-pointer hover:opacity-80 transition-opacity",
                            match.result === "W" && "bg-emerald-500 text-white",
                            match.result === "L" && "bg-destructive text-white",
                            match.result === "T"
                            && "bg-muted-foreground text-white",
                          )}
                        >
                          {match.result}
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
                  <TableRow>
                    <TableCell colSpan={6} className="text-center align-middle">
                      <div className="flex h-full w-full items-center gap-4 px-4">
                        <div className="h-px flex-1 bg-emerald-500/50" />
                        <span className="text-[10px] font-bold tracking-widest text-emerald-500/80 uppercase">
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
