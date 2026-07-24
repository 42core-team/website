import { BadRequestException } from "@nestjs/common";

export function hasGamblingStarted(startDate: Date, now = new Date()) {
  return startDate <= now;
}

export function requireGamblingStarted(startDate: Date, now = new Date()) {
  if (!hasGamblingStarted(startDate, now))
    throw new BadRequestException(
      "Gambling is available after the event starts.",
    );
}

export function requireGamblingTeam<T>(team: T | null): T {
  if (!team)
    throw new BadRequestException(
      "Create or join a team before using gambling.",
    );
  return team;
}
