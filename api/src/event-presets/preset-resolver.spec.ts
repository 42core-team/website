import {
  resolvePresetSettings,
  resolveSchedule,
  scheduleHours,
} from "./preset-resolver";
import type { PresetSettingsDto } from "./dtos/preset-settings.dto";

const at = (iso: string) => new Date(iso);
const utc = (iso: string) => Date.parse(iso);
const HOUR = 60 * 60 * 1000;

describe("resolveSchedule", () => {
  const start = (now: string, startOffsetDays: number, startTime: string) =>
    resolveSchedule({ startOffsetDays, startTime }, at(now)).startDate;

  it("starts at the Berlin wall-clock time, offset days after today", () => {
    // Summer time, UTC+2.
    expect(start("2026-07-01T12:00:00Z", 0, "10:00")).toBe(
      utc("2026-07-01T08:00:00Z"),
    );
    expect(start("2026-07-01T12:00:00Z", 3, "18:30")).toBe(
      utc("2026-07-04T16:30:00Z"),
    );
    // Winter time, UTC+1.
    expect(start("2026-12-01T12:00:00Z", 0, "10:00")).toBe(
      utc("2026-12-01T09:00:00Z"),
    );
  });

  it("reads today in Berlin, not in UTC", () => {
    // 00:30 on July 1 in Berlin is still June 30 in UTC.
    expect(start("2026-06-30T22:30:00Z", 0, "10:00")).toBe(
      utc("2026-07-01T08:00:00Z"),
    );
    // 23:30 on June 30 in Berlin.
    expect(start("2026-06-30T21:30:00Z", 0, "10:00")).toBe(
      utc("2026-06-30T08:00:00Z"),
    );
    // Across the new year, in winter time.
    expect(start("2026-12-31T23:30:00Z", 1, "10:00")).toBe(
      utc("2027-01-02T09:00:00Z"),
    );
  });

  it("keeps the wall-clock time across the spring switch (2026-03-29)", () => {
    expect(start("2026-03-27T12:00:00Z", 0, "10:00")).toBe(
      utc("2026-03-27T09:00:00Z"),
    );
    // Two calendar days later is 47 hours later.
    expect(start("2026-03-27T12:00:00Z", 2, "10:00")).toBe(
      utc("2026-03-29T08:00:00Z"),
    );
    // The switch itself: 01:59 CET is followed by 03:00 CEST.
    expect(start("2026-03-27T12:00:00Z", 2, "01:59")).toBe(
      utc("2026-03-29T00:59:00Z"),
    );
    expect(start("2026-03-27T12:00:00Z", 2, "03:00")).toBe(
      utc("2026-03-29T01:00:00Z"),
    );
  });

  it("moves a time skipped in spring forward by the gap", () => {
    expect(start("2026-03-27T12:00:00Z", 2, "02:30")).toBe(
      utc("2026-03-29T01:30:00Z"),
    );
  });

  it("keeps the wall-clock time across the autumn switch (2026-10-25)", () => {
    expect(start("2026-10-24T12:00:00Z", 0, "10:00")).toBe(
      utc("2026-10-24T08:00:00Z"),
    );
    // One calendar day later is 25 hours later.
    expect(start("2026-10-24T12:00:00Z", 1, "10:00")).toBe(
      utc("2026-10-25T09:00:00Z"),
    );
  });

  it("takes the first of an autumn time that happens twice", () => {
    // 02:30 happens at 00:30 UTC (CEST) and again at 01:30 UTC (CET).
    expect(start("2026-10-24T12:00:00Z", 1, "02:30")).toBe(
      utc("2026-10-25T00:30:00Z"),
    );
  });

  it("reads today correctly on the night of a switch", () => {
    // 03:30 CEST on the day clocks go back; still Oct 25 in Berlin.
    expect(start("2026-10-25T01:30:00Z", 0, "12:00")).toBe(
      utc("2026-10-25T11:00:00Z"),
    );
  });

  it("adds hours as elapsed time, not wall-clock time", () => {
    const dates = resolveSchedule(
      {
        startOffsetDays: 0,
        startTime: "22:00",
        submissionDeadlineAfterHours: 12,
        scheduledEndAfterHours: 36,
        endAfterHours: 1.5,
      },
      at("2026-03-28T12:00:00Z"),
    );
    // 22:00 CET; 12 hours later is 11:00 CEST on the wall clock.
    expect(dates).toEqual({
      startDate: utc("2026-03-28T21:00:00Z"),
      submissionDeadline: utc("2026-03-29T09:00:00Z"),
      scheduledEndDate: utc("2026-03-30T09:00:00Z"),
      endDate: utc("2026-03-28T22:30:00Z"),
    });
  });

  it("falls back to the end's hours, then to one and two hours", () => {
    expect(scheduleHours({ startOffsetDays: 0, startTime: "10:00" })).toEqual({
      submissionDeadline: 1,
      scheduledEnd: 2,
      end: 2,
    });
    expect(
      scheduleHours({
        startOffsetDays: 0,
        startTime: "10:00",
        endAfterHours: 48,
      }),
    ).toEqual({ submissionDeadline: 48, scheduledEnd: 48, end: 48 });
    expect(
      scheduleHours({
        startOffsetDays: 0,
        startTime: "10:00",
        scheduledEndAfterHours: 5,
      }),
    ).toEqual({ submissionDeadline: 1, scheduledEnd: 5, end: 5 });

    const dates = resolveSchedule(
      { startOffsetDays: 0, startTime: "10:00" },
      at("2026-07-01T00:00:00Z"),
    );
    expect(dates.submissionDeadline - dates.startDate).toBe(HOUR);
    expect(dates.scheduledEndDate - dates.startDate).toBe(2 * HOUR);
    expect(dates.endDate).toBe(dates.scheduledEndDate);
  });
});

describe("resolvePresetSettings", () => {
  const settings = {
    minTeamSize: 2,
    maxTeamSize: 3,
    gameServerDockerImage: "example.com/server:dev",
    myCoreBotDockerImage: "example.com/bot:v1.2.3",
    visualizerDockerImage: "example.com/visualizer:latest",
    monorepoUrl: "https://github.com/42core-team/monorepo",
    monorepoVersion: "dev",
    basePath: "bots/c/bot",
    gameConfig: "{}",
    serverConfig: "{}",
    schedule: { startOffsetDays: 1, startTime: "10:00" },
  } satisfies PresetSettingsDto;

  it("fills optional settings with their defaults", () => {
    expect(resolvePresetSettings(settings, at("2026-07-01T12:00:00Z"))).toEqual(
      {
        ...settings,
        schedule: undefined,
        description: "",
        location: "",
        introEnabled: false,
        introLeadMinutes: 15,
        streamUrl: "",
        showtimeStreamUrl: "",
        startDate: utc("2026-07-02T08:00:00Z"),
        submissionDeadline: utc("2026-07-02T09:00:00Z"),
        scheduledEndDate: utc("2026-07-02T10:00:00Z"),
        endDate: utc("2026-07-02T10:00:00Z"),
      },
    );
  });

  it("keeps set values, drops nulls and unknown keys", () => {
    const resolved = resolvePresetSettings({
      ...settings,
      description: "Spring cup",
      introEnabled: true,
      introLeadMinutes: 0,
      streamUrl: null,
      name: "not a setting",
      isPrivate: false,
      githubOrgSecret: "nope",
    } as unknown as PresetSettingsDto);
    expect(resolved).toMatchObject({
      description: "Spring cup",
      introEnabled: true,
      introLeadMinutes: 0,
      streamUrl: "",
    });
    expect(resolved).not.toHaveProperty("schedule");
    expect(resolved).not.toHaveProperty("name");
    expect(resolved).not.toHaveProperty("isPrivate");
    expect(resolved).not.toHaveProperty("githubOrgSecret");
  });

  it("stores image tags verbatim", () => {
    const resolved = resolvePresetSettings(settings);
    expect(resolved.myCoreBotDockerImage).toBe("example.com/bot:v1.2.3");
    expect(resolved.visualizerDockerImage).toBe(
      "example.com/visualizer:latest",
    );
  });
});
