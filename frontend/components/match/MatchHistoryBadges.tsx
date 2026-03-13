"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface MatchResult {
  id: string;
  result: "W" | "L" | "T" | string;
}

interface MatchHistoryBadgesProps {
  history: MatchResult[];
  eventId: string;
}

export function MatchHistoryBadges({
  history,
  eventId,
}: MatchHistoryBadgesProps) {
  const router = useRouter();

  if (history.length === 0) {
    return <span className="text-xs text-muted-foreground">No matches</span>;
  }

  return (
    <>
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
            match.result === "T" && "bg-muted-foreground text-white",
          )}
        >
          {match.result}
        </div>
      ))}
    </>
  );
}
