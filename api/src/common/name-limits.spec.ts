import "reflect-metadata";
import { ClassConstructor, plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateEventDto } from "../event/dtos/createEventDto";
import { UpdateEventSettingsDto } from "../event/dtos/updateEventSettingsDto";
import { CreateTeamDto } from "../team/dtos/createTeamDto";
import {
  EVENT_NAME_MAX_LENGTH,
  EVENT_NAME_MAX_LENGTH_MESSAGE,
  GITHUB_REPO_NAME_MAX_LENGTH,
  TEAM_ID_LENGTH,
  TEAM_NAME_MAX_LENGTH,
} from "./name-limits";

async function nameErrors<T extends object>(
  cls: ClassConstructor<T>,
  body: Record<string, unknown>,
) {
  const errors = await validate(plainToInstance(cls, body));
  return errors.find((error) => error.property === "name")?.constraints;
}

describe("event name length", () => {
  it("leaves room for the team name and id in the repository name", () => {
    expect(EVENT_NAME_MAX_LENGTH).toBe(32);
    expect(EVENT_NAME_MAX_LENGTH + 1 + 30 + 1 + 36).toBe(100);
    expect(
      EVENT_NAME_MAX_LENGTH + 1 + TEAM_NAME_MAX_LENGTH + 1 + TEAM_ID_LENGTH,
    ).toBe(GITHUB_REPO_NAME_MAX_LENGTH);
  });

  describe("CreateEventDto", () => {
    it("accepts a name of the maximum length", async () => {
      expect(
        await nameErrors(CreateEventDto, { name: "a".repeat(32) }),
      ).toBeUndefined();
    });

    it("rejects a name longer than the maximum", async () => {
      expect(
        await nameErrors(CreateEventDto, { name: "a".repeat(33) }),
      ).toEqual({ maxLength: EVENT_NAME_MAX_LENGTH_MESSAGE });
    });

    it("still rejects a name shorter than 3 characters", async () => {
      expect(await nameErrors(CreateEventDto, { name: "ab" })).toHaveProperty(
        "minLength",
      );
    });
  });

  describe("UpdateEventSettingsDto", () => {
    it("accepts an omitted name", async () => {
      expect(await nameErrors(UpdateEventSettingsDto, {})).toBeUndefined();
    });

    it("accepts a name of the maximum length", async () => {
      expect(
        await nameErrors(UpdateEventSettingsDto, { name: "a".repeat(32) }),
      ).toBeUndefined();
    });

    it("rejects a name longer than the maximum", async () => {
      expect(
        await nameErrors(UpdateEventSettingsDto, { name: "a".repeat(33) }),
      ).toEqual({ maxLength: EVENT_NAME_MAX_LENGTH_MESSAGE });
    });
  });
});

describe("team name length", () => {
  async function teamNameErrors(name: string) {
    const errors = await validate(plainToInstance(CreateTeamDto, { name }));
    return errors.find((error) => error.property === "name")?.constraints;
  }

  it("accepts 4 to 30 characters", async () => {
    expect(await teamNameErrors("a".repeat(4))).toBeUndefined();
    expect(await teamNameErrors("a".repeat(30))).toBeUndefined();
  });

  it("keeps the existing message for names outside that range", async () => {
    const message =
      "Name can only contain letters, numbers, underscores, dots, and hyphens. Must be between 4 and 30 characters.";
    expect(await teamNameErrors("a".repeat(3))).toEqual({ matches: message });
    expect(await teamNameErrors("a".repeat(31))).toEqual({ matches: message });
  });
});
