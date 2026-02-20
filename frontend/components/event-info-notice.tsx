"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface EventJoinNoticeProps {
  userId: string;
  startDate: string;
}

export default function EventInfoNotice({
  userId: _userId,
  startDate,
}: Readonly<EventJoinNoticeProps>) {
  const router = useRouter();
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

  const timeLeftMs = startsAt.getTime() - now.getTime();

  if (hasStarted) {
    return <></>;
  }

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
