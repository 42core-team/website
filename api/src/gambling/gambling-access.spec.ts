import { BadRequestException } from "@nestjs/common";
import {
  hasGamblingStarted,
  requireGamblingEnabled,
  requireGamblingStarted,
  requireGamblingTeam,
} from "./gambling-access";

describe("gambling access", () => {
  const now = new Date("2026-07-24T12:00:00.000Z");

  it("allows gambling at and after the event start time", () => {
    expect(hasGamblingStarted(now, now)).toBe(true);
    expect(hasGamblingStarted(new Date("2026-07-24T11:59:59.000Z"), now)).toBe(
      true,
    );
  });

  it("rejects gambling before the event starts", () => {
    expect(() =>
      requireGamblingStarted(new Date("2026-07-24T12:00:01.000Z"), now),
    ).toThrow(
      new BadRequestException("Gambling is available after the event starts."),
    );
  });

  it("rejects gambling when it is disabled for the event", () => {
    expect(() => requireGamblingEnabled(false)).toThrow(
      new BadRequestException("Gambling is disabled for this event."),
    );
    expect(() => requireGamblingEnabled(true)).not.toThrow();
  });

  it("returns an existing team", () => {
    const team = { id: "team-id" };
    expect(requireGamblingTeam(team)).toBe(team);
  });

  it("rejects users without an event team", () => {
    expect(() => requireGamblingTeam(null)).toThrow(
      new BadRequestException("Create or join a team before using gambling."),
    );
  });
});
