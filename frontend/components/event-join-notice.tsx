"use client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState, useRef } from "react";
import { joinEvent } from "@/app/actions/event";
import { useRouter } from "next/navigation";

interface EventJoinNoticeProps {
  eventId: string;
  userId: string;
  startDate: string;
}

export default function EventJoinNotice({
  eventId,
  userId: _userId,
  startDate,
}: EventJoinNoticeProps) {
  const router = useRouter();
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const startsAt = new Date(startDate);
  const hasStarted = startsAt <= now;
  const didRefreshRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const timeLeftMs = startsAt.getTime() - now.getTime();
    if (!didRefreshRef.current && timeLeftMs <= 0) {
      didRefreshRef.current = true;
      router.refresh();
    }
  }, [now, startsAt, router]);

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

  const handleJoin = async () => {
    if (!hasStarted) return;
    setIsJoining(true);
    setError(null);

    try {
      const success = await joinEvent(eventId);

      if (success) {
        router.refresh();
      } else {
        setError("Failed to join the event. Please try again.");
      }
    } catch (err) {
      console.error("Error joining event:", err);
      setError("Failed to join the event. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  const timeLeftMs = startsAt.getTime() - now.getTime();

  return (
    <div className="w-full bg-primary-50 border-b border-primary-200">
      <div className="container mx-auto max-w-7xl px-6 h-14 flex items-center justify-between">
        {hasStarted ? (
          <>
            <p className="text-primary-700">
              Join this event to participate with your team!
            </p>
            <div className="flex items-center gap-4">
              {error && <span className="text-danger text-sm">{error}</span>}
              <Button
                color="primary"
                // TODO: isLoading={isJoining}
                onClick={handleJoin}
              >
                Join Event
              </Button>
            </div>
          </>
        ) : (
          <div className="w-full flex items-center justify-between">
            <p className="text-warning-400">
              This event has not started yet. You can join once it begins.
            </p>
            <Badge variant="destructive" aria-label="Event countdown">
              Starts in {formatTimeLeft(timeLeftMs)}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
