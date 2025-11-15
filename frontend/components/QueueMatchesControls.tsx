"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, FormEvent, useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DateRangePicker, Select, SelectItem } from "@heroui/react";
import { parseAbsoluteToLocal, ZonedDateTime } from "@internationalized/date";

type Interval = "minute" | "hour" | "day";

export default function QueueMatchesControls({
  initialInterval,
  initialStartISO,
  initialEndISO,
}: {
  initialInterval: Interval;
  initialStartISO: string;
  initialEndISO: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [interval, setInterval] = useState<Interval>(initialInterval);
  const [range, setRange] = useState<{
    start: ZonedDateTime;
    end: ZonedDateTime;
  }>({
    start: initialStartISO
      ? parseAbsoluteToLocal(initialStartISO)
      : parseAbsoluteToLocal(new Date().toISOString()),
    end: initialEndISO
      ? parseAbsoluteToLocal(initialEndISO)
      : parseAbsoluteToLocal(new Date().toISOString()),
  });

  const onChangeInterval = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    const next = (e.target.value as Interval) || "hour";
    setInterval(next);
  }, []);

  const apply = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();

      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("interval", interval);

      const startISO = range.start
        ? range.start.toDate().toISOString()
        : undefined;
      const endISO = range.end ? range.end.toDate().toISOString() : undefined;

      if (startISO) params.set("start", startISO);
      else params.delete("start");
      if (endISO) params.set("end", endISO);
      else params.delete("end");

      router.replace(`${pathname}?${params.toString()}`);
    },
    [interval, pathname, range.end, range.start, router, searchParams]
  );

  const canApply = useMemo(
    () => !!range.start && !!range.end,
    [range.end, range.start]
  );

  return (
    <form
      onSubmit={apply}
      className="flex flex-col md:flex-row items-end gap-4"
    >
      <div>
        <label className="block text-sm font-medium mb-1">
          Bucket interval
        </label>
        <Select defaultSelectedKeys={[interval]} onChange={onChangeInterval}>
          <SelectItem key="minute">Minute</SelectItem>
          <SelectItem key="hour">Hour</SelectItem>
          <SelectItem key="day">Day</SelectItem>
        </Select>
      </div>

      <div className="flex-1 min-w-[280px]">
        <label className="block text-sm font-medium mb-1">Date range</label>
        <DateRangePicker
          hideTimeZone
          showMonthAndYearPickers
          granularity={
            interval === "minute"
              ? "minute"
              : interval === "hour"
                ? "hour"
                : "day"
          }
          defaultValue={range}
          onChange={(v) => {
            if (v) setRange({ start: v.start, end: v.end });
          }}
          aria-label="Range"
          className="w-full"
        />
      </div>

      <Button
        type="submit"
        className="inline-flex items-center gap-1 rounded bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm"
        onClick={() => apply()}
        disabled={!canApply}
      >
        Apply
      </Button>
    </form>
  );
}
