"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEventAccess } from "@/contexts/EventAccessContext";
import { browserEventsApi } from "@/lib/backend/browser";

export default function EventInfoNotice() {
  const queryClient = useQueryClient();
  const {
    eventId,
    isPrivate,
    isUserRegistered,
    setEventAccess,
    startDate,
  } = useEventAccess();
  const [now, setNow] = useState<Date>(new Date());
  const startsAt = new Date(startDate);
  const hasStarted = startsAt <= now;
  const didRefreshRef = useRef(false);

  const showJoinButton = isPrivate && !isUserRegistered;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const timeLeftMs = startsAt.getTime() - now.getTime();
    if (!didRefreshRef.current && timeLeftMs <= 0) {
      didRefreshRef.current = true;
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    }
  }, [eventId, now, queryClient, startsAt]);

  const formatTimeLeft = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    const hhmmss = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    return days > 0 ? `${days}d ${hhmmss}` : hhmmss;
  };

  const timeLeftMs = startsAt.getTime() - now.getTime();

  const joinEventMutation = useMutation({
    mutationFn: () => browserEventsApi.joinEvent(eventId),
    onSuccess: () => {
      setEventAccess({ isUserRegistered: true });
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event", eventId, "my-team"] });
    },
  });

  if (!showJoinButton && hasStarted) {
    return <></>;
  }

  if (!showJoinButton && !hasStarted) {
    return (
      <div className="border-primary-200 mt-5 w-full border-b bg-primary-50 pb-7 sm:mt-0 sm:pb-0">
        <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex w-full flex-wrap items-center justify-between">
            <p className="text-warning-400">
              This event has not started yet. You can start coding when the
              countdown ends.
            </p>
            <Badge variant="destructive" aria-label="Event countdown">
              Starts in
              {" "}
              {formatTimeLeft(timeLeftMs)}
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-primary-200 mt-5 w-full border-b bg-primary-50 pb-7 sm:mt-0 sm:pb-0">
      <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {!hasStarted && (
            <p className="text-warning-400">
              This event has not started yet. You can join now and start coding when the
              countdown ends.
            </p>
          )}
          {hasStarted && (
            <p className="text-warning-400">
              This is a private event. Join to participate and create a team.
            </p>
          )}
          <div className="flex items-center gap-2">
            {!hasStarted && (
              <Badge variant="destructive" aria-label="Event countdown">
                Starts in
                {" "}
                {formatTimeLeft(timeLeftMs)}
              </Badge>
            )}
            <Button
              onClick={() => joinEventMutation.mutate()}
              disabled={joinEventMutation.isPending}
              size="sm"
            >
              {joinEventMutation.isPending ? "Joining..." : "Join Event"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
