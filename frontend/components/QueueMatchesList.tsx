import type { Match } from "@/app/actions/tournament-model";
import Link from "next/link";
import { MatchState } from "@/app/actions/tournament-model";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function QueueMatchesList(props: {
  eventId: string;
  matches: Match[];
  hideUuid?: boolean;
  hideReplay?: boolean;
  isInsideCard?: boolean;
}) {
  const { eventId, matches, hideUuid, hideReplay, isInsideCard } = props;

  if (!matches || matches.length === 0) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        !isInsideCard && "border rounded-lg bg-muted/10"
      )}>
        <p className="text-muted-foreground font-medium">No past matches found</p>
      </div>
    );
  }

  const listContent = (
    <div className={cn("flex flex-col", isInsideCard ? "divide-y" : "gap-4")}>
      {matches.map((match, index) => {
        const content = (
          <div className="flex flex-col sm:flex-row items-stretch">
            {/* Match Meta */}
            <div className={cn(
              "px-4 py-3 sm:w-40 bg-muted/10 flex flex-row sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-2",
              !isInsideCard && "bg-muted/20 border-b sm:border-b-0 sm:border-r"
            )}>
              <Badge
                variant={match.state === MatchState.FINISHED ? "secondary" : "default"}
                className={cn(
                  "text-[10px] uppercase font-bold px-1.5",
                  match.state === MatchState.FINISHED && "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400 border-success-200/50",
                  match.state === MatchState.IN_PROGRESS && "bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400 border-warning-200/50",
                )}
              >
                {match.state}
              </Badge>
              <div className="flex flex-col text-right sm:text-left">
                <span className="text-xs text-muted-foreground font-medium">
                  {new Date(match.createdAt).toLocaleDateString()}
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  {new Date(match.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {/* Match Content */}
            <div className="flex-1 p-6 flex items-center justify-center">
              <div className="flex items-center justify-center w-full max-w-2xl gap-4 sm:gap-12">
                {/* Team 1 */}
                <div className="flex-1 flex flex-col items-end gap-1 min-w-0">
                  {match.teams[0] ? (
                    <>
                      {match.teams[0].deletedAt ? (
                        <div className="flex flex-col items-end w-full">
                          <span className="text-sm sm:text-base font-semibold truncate text-muted-foreground/50 line-through">
                            {match.teams[0].name}
                          </span>
                        </div>
                      ) : (
                        <Link
                          href={`/events/${eventId}/teams/${match.teams[0].id}`}
                          className={cn(
                            "text-sm sm:text-base font-semibold truncate hover:underline hover:text-primary transition-colors text-right w-full",
                            match.winner?.id === match.teams[0].id ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {match.teams[0].name}
                          {match.winner?.id === match.teams[0].id && (
                            <span className="ml-2">👑</span>
                          )}
                        </Link>
                      )}
                      <span className={cn(
                        "text-2xl sm:text-3xl font-bold tracking-tighter",
                        match.winner?.id === match.teams[0].id ? "text-foreground" : "text-muted-foreground/40",
                      )}>
                        {match.results.find(r => r.team?.id === match.teams[0].id)?.score ?? 0}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground/40 italic">Unknown</span>
                  )}
                </div>

                {/* VS */}
                <div className="flex flex-col items-center justify-center">
                  <span className="text-[10px] font-black text-muted-foreground/30">VS</span>
                </div>

                {/* Team 2 */}
                <div className="flex-1 flex flex-col items-start gap-1 min-w-0">
                  {match.teams[1] ? (
                    <>
                      {match.teams[1].deletedAt ? (
                        <div className="flex flex-col items-start w-full">
                          <span className="text-sm sm:text-base font-semibold truncate text-muted-foreground/50 line-through">
                            {match.teams[1].name}
                          </span>
                        </div>
                      ) : (
                        <Link
                          href={`/events/${eventId}/teams/${match.teams[1].id}`}
                          className={cn(
                            "text-sm sm:text-base font-semibold truncate hover:underline hover:text-primary transition-colors text-left w-full",
                            match.winner?.id === match.teams[1].id ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {match.winner?.id === match.teams[1].id && (
                            <span className="mr-2">👑</span>
                          )}
                          {match.teams[1].name}
                        </Link>
                      )}
                      <span className={cn(
                        "text-2xl sm:text-3xl font-bold tracking-tighter",
                        match.winner?.id === match.teams[1].id ? "text-foreground" : "text-muted-foreground/40",
                      )}>
                        {match.results.find(r => r.team?.id === match.teams[1].id)?.score ?? 0}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground/40 italic">Unknown</span>
                  )}
                </div>
              </div>
            </div>

            {/* Replay */}
            {!hideReplay && match.id && (
              <div className={cn(
                "flex items-center justify-center px-6 pb-4 sm:pb-0",
                !isInsideCard && "sm:border-l border-border/40"
              )}>
                <Link href={`/events/${eventId}/match/${match.id}`}>
                  <Button size="sm" variant="secondary" className="font-bold text-xs uppercase">
                    Replay
                  </Button>
                </Link>
              </div>
            )}
          </div>
        );

        if (isInsideCard) {
          return (
            <div key={match.id || index} className="w-full">
              {content}
            </div>
          );
        }

        return (
          <Card
            key={match.id || index}
            className="overflow-hidden border shadow-sm"
          >
            <CardContent className="p-0">
              {content}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  return listContent;
}
