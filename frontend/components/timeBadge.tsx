"use client";

import { Chip } from "@heroui/react";

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
  const date = new Date(time);
  const formatted = date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Chip variant={variant} color={color} className={className}>
      {formatted}
    </Chip>
  );
}
