"use client";

import type { Team } from "@/app/actions/team";
import type { Match } from "@/app/actions/tournament-model";
import { Award, Medal, Trophy } from "lucide-react";
import Link from "next/link";
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
}

export default function BracketRankingTable({
  teams,
  matches,
  eventId,
}: RankingTableProps) {
  const maxRound = Math.max(...matches.map(m => m.round), 1);

  const getTeamStats = (teamId: string) => {
    const teamMatches = matches.filter(m =>
      m.teams.some(t => t.id === teamId),
    );

    const highestRound = Math.max(...teamMatches.map(m => m.round), 0);
    const lastMatch = teamMatches.find(m => m.round === highestRound);

    let actualRank = 0;

    if (highestRound === 0) {
      actualRank = 2 ** maxRound + 1;
    }
    else if (highestRound === maxRound) {
      if (lastMatch?.isPlacementMatch) {
        if (lastMatch.winner) {
          actualRank = lastMatch.winner.id === teamId ? 3 : 4;
        }
        else {
          actualRank = 3; // In-progress tie
        }
      }
      else {
        if (lastMatch?.winner) {
          actualRank = lastMatch.winner.id === teamId ? 1 : 2;
        }
        else {
          actualRank = 1; // In-progress tie
        }
      }
    }
    else {
      actualRank = 2 ** (maxRound - highestRound) + 1;
    }

    return { highestRound, actualRank, hasMatches: teamMatches.length > 0 };
  };

  const teamsWithStats = teams
    .map(team => ({
      ...team,
      ...getTeamStats(team.id),
    }))
    .filter(team => team.hasMatches);

  const sortedTeams = [...teamsWithStats].sort((a, b) => {
    if (a.actualRank !== b.actualRank)
      return a.actualRank - b.actualRank;
    if (b.score !== a.score)
      return b.score - a.score;
    return b.buchholzPoints - a.buchholzPoints;
  });

  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-xl border bg-card/50 shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="w-[100px] text-center font-bold">
                Standing
              </TableHead>
              <TableHead className="font-bold">Team Name</TableHead>
              <TableHead className="hidden text-center font-bold sm:table-cell">
                Swiss Score
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTeams.map((team) => {
              const rank = team.actualRank;
              const isWinner = rank === 1;
              const isFinalist = rank === 2;
              const isSemi = rank === 3;

              return (
                <TableRow
                  key={team.id}
                  className={cn(
                    "group transition-all hover:bg-muted/40",
                    isWinner
                    && "bg-yellow-500/5 hover:bg-yellow-500/10 border-l-4 border-l-yellow-500",
                    isFinalist
                    && "bg-slate-500/5 hover:bg-slate-500/10 border-l-4 border-l-slate-400",
                    isSemi && "border-l-4 border-l-amber-700/50",
                    !isWinner
                    && !isFinalist
                    && !isSemi
                    && "border-l-4 border-l-transparent border-b border-border/40",
                  )}
                >
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      {isWinner
                        ? (
                            <Trophy className="h-6 w-6 text-yellow-500" />
                          )
                        : isFinalist
                          ? (
                              <Medal className="h-6 w-6 text-slate-400" />
                            )
                          : isSemi
                            ? (
                                <Award className="h-6 w-6 text-amber-700" />
                              )
                            : (
                                <span className="font-mono font-bold text-muted-foreground">
                                  {rank}
                                </span>
                              )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/events/${eventId}/teams/${team.id}`}
                      className="inline-block max-w-[250px] truncate text-base font-bold transition-colors hover:text-primary"
                    >
                      {team.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden pr-6 text-center font-mono text-muted-foreground sm:table-cell">
                    {(team.score ?? 0).toFixed(1)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
