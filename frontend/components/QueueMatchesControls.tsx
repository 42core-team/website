"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
    start: Date | undefined;
    end: Date | undefined;
  }>({
    start: initialStartISO ? new Date(initialStartISO) : new Date(),
    end: initialEndISO ? new Date(initialEndISO) : new Date(),
  });

  const onChangeInterval = useCallback((value: string) => {
    const next = (value as Interval) || "hour";
    setInterval(next);
  }, []);

  const apply = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();

      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("interval", interval);

      const startISO = range.start ? range.start.toISOString() : undefined;
      const endISO = range.end ? range.end.toISOString() : undefined;

      if (startISO) params.set("start", startISO);
      else params.delete("start");
      if (endISO) params.set("end", endISO);
      else params.delete("end");

      router.replace(`${pathname}?${params.toString()}`);
    },
    [interval, pathname, range.end, range.start, router, searchParams],
  );

  const canApply = useMemo(
    () => !!range.start && !!range.end,
    [range.end, range.start],
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
        <Select value={interval} onValueChange={onChangeInterval}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select interval" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minute">Minute</SelectItem>
            <SelectItem value="hour">Hour</SelectItem>
            <SelectItem value="day">Day</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 min-w-[280px]">
        <label className="block text-sm font-medium mb-1">Date range</label>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "flex-1 justify-start text-left font-normal",
                  !range.start && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {range.start ? (
                  format(range.start, interval === "day" ? "PP" : "PPp")
                ) : (
                  <span>Start date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={range.start}
                onSelect={(date) =>
                  setRange((prev) => ({ ...prev, start: date }))
                }
                initialFocus
              />
              {interval !== "day" && (
                <div className="p-3 border-t">
                  <Input
                    type="time"
                    value={range.start ? format(range.start, "HH:mm") : ""}
                    onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(":");
                      const newDate = range.start
                        ? new Date(range.start)
                        : new Date();
                      newDate.setHours(parseInt(hours), parseInt(minutes));
                      setRange((prev) => ({ ...prev, start: newDate }));
                    }}
                  />
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "flex-1 justify-start text-left font-normal",
                  !range.end && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {range.end ? (
                  format(range.end, interval === "day" ? "PP" : "PPp")
                ) : (
                  <span>End date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={range.end}
                onSelect={(date) =>
                  setRange((prev) => ({ ...prev, end: date }))
                }
                initialFocus
              />
              {interval !== "day" && (
                <div className="p-3 border-t">
                  <Input
                    type="time"
                    value={range.end ? format(range.end, "HH:mm") : ""}
                    onChange={(e) => {
                      const [hours, minutes] = e.target.value.split(":");
                      const newDate = range.end
                        ? new Date(range.end)
                        : new Date();
                      newDate.setHours(parseInt(hours), parseInt(minutes));
                      setRange((prev) => ({ ...prev, end: newDate }));
                    }}
                  />
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Button type="submit" onClick={() => apply()} disabled={!canApply}>
        Apply
      </Button>
    </form>
  );
}
