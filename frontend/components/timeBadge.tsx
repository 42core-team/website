"use client";

import { Chip } from "@heroui/react";
import { useState, useEffect } from "react";

export default function TimeBadge({
  time,
  className = "",
  variant = "faded",
  color = "success",
}: {
  time: string | Date;
  className?: string;
  variant?:
    | "faded"
    | "flat"
    | "solid"
    | "bordered"
    | "light"
    | "shadow"
    | "dot"
    | undefined;
  color?:
    | "default"
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "danger"
    | undefined;
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
    <Chip variant={variant} color={color} className={className}>
      {formatted}
    </Chip>
  );
}
