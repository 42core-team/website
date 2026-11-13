/// <reference lib="esnext.temporal" />
import {
  EVENT_DATE_FIELDS,
  EventSettingsDto,
  PRESET_SETTING_FIELDS,
} from "../event/dtos/eventSettingsDto";
import type {
  PresetScheduleDto,
  PresetSettingsDto,
} from "./dtos/preset-settings.dto";

/** The zone a preset's start time and "today" are read in. */
export const PRESET_TIME_ZONE = "Europe/Berlin";

/** When a schedule names neither its own nor the end's hours. */
export const DEFAULT_SUBMISSION_DEADLINE_AFTER_HOURS = 1;
export const DEFAULT_SCHEDULED_END_AFTER_HOURS = 2;

const HOUR_MS = 60 * 60 * 1000;

/** What a preset's optional settings default to. */
const OPTIONAL_DEFAULTS = {
  description: "",
  location: "",
  introEnabled: false,
  introLeadMinutes: 15,
  streamUrl: "",
  showtimeStreamUrl: "",
};

type EventDates = Pick<EventSettingsDto, (typeof EVENT_DATE_FIELDS)[number]>;

/** Every event setting a preset provides; only the name is missing. */
export type ResolvedPresetValues = Omit<EventSettingsDto, "name" | "isPrivate">;

/**
 * Hours from the start to the submission deadline and the scheduled end.
 * Each falls back to `endAfterHours`, as create requests fall back to
 * `endDate`, and then to the create form's former defaults.
 */
export function scheduleHours(schedule: PresetScheduleDto) {
  const scheduledEnd =
    schedule.scheduledEndAfterHours ??
    schedule.endAfterHours ??
    DEFAULT_SCHEDULED_END_AFTER_HOURS;
  return {
    submissionDeadline:
      schedule.submissionDeadlineAfterHours ??
      schedule.endAfterHours ??
      DEFAULT_SUBMISSION_DEADLINE_AFTER_HOURS,
    scheduledEnd,
    end: schedule.endAfterHours ?? scheduledEnd,
  };
}

/**
 * The start is the wall-clock `startTime` in Europe/Berlin, `startOffsetDays`
 * after today there; a time skipped by the spring DST switch moves forward
 * by the gap and a repeated autumn time takes its first occurrence. The
 * other dates are absolute hours after the start. Epoch milliseconds.
 */
export function resolveSchedule(
  schedule: PresetScheduleDto,
  now: Date = new Date(),
): EventDates {
  const [hour, minute] = schedule.startTime.split(":").map(Number);
  const startDate = Temporal.Instant.fromEpochMilliseconds(now.getTime())
    .toZonedDateTimeISO(PRESET_TIME_ZONE)
    .toPlainDate()
    .add({ days: schedule.startOffsetDays })
    .toZonedDateTime({
      timeZone: PRESET_TIME_ZONE,
      plainTime: new Temporal.PlainTime(hour, minute),
    }).epochMilliseconds;
  const hours = scheduleHours(schedule);
  const after = (count: number) => startDate + Math.round(count * HOUR_MS);
  return {
    startDate,
    endDate: after(hours.end),
    submissionDeadline: after(hours.submissionDeadline),
    scheduledEndDate: after(hours.scheduledEnd),
  };
}

/**
 * A preset's stored settings as the full values of a new event. Unknown
 * keys in the stored JSON are dropped; missing or null optional settings
 * take their defaults.
 */
export function resolvePresetSettings(
  settings: PresetSettingsDto,
  now?: Date,
): ResolvedPresetValues {
  const stored = settings as unknown as Record<string, unknown>;
  const values: Record<string, unknown> = { ...OPTIONAL_DEFAULTS };
  for (const field of PRESET_SETTING_FIELDS)
    if (stored[field] !== undefined && stored[field] !== null)
      values[field] = stored[field];
  return {
    ...(values as Omit<ResolvedPresetValues, keyof EventDates>),
    ...resolveSchedule(settings.schedule, now),
  };
}
