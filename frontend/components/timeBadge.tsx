"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

export default function TimeBadge({
  time,
  className = "",
  variant = "default",
  // TODO:color = "success",
}: {
  time: string | Date;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "destructive";
  // TODO:  color?: undefined;
}) {
  const [formatted, setFormatted] = useState(() => {
    const date = new Date(time);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  });

  useEffect(() => {
    const date = new Date(time);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const locale = navigator.language || "en-US";
    setFormatted(
      date.toLocaleString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      }),
    );
  }, [time]);

  return (
    <Badge variant={variant} className={className}>
      {formatted}
    </Badge>
  );
}
