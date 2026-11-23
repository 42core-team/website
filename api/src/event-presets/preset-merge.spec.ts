import { BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { strictBody } from "../common/strict-body";
import { CreateEventDto } from "../event/dtos/createEventDto";
import { mergeEventSettings } from "./preset-merge";
import { resolvePresetSettings } from "./preset-resolver";
import { PRESET_SETTINGS } from "./testing";

const NOW = new Date("2026-07-01T12:00:00Z");
const resolved = resolvePresetSettings(
  { ...PRESET_SETTINGS, description: "From the preset", streamUrl: "" },
  NOW,
);
const request = (body: object) =>
  plainToInstance(CreateEventDto, { name: "Summer Cup", ...body });

describe("mergeEventSettings", () => {
  it("takes every value the request leaves out from the preset", async () => {
    await expect(mergeEventSettings(resolved, request({}))).resolves.toEqual({
      ...resolved,
      name: "Summer Cup",
      isPrivate: true,
    });
  });

  it("lets the request override settings and dates", async () => {
    const merged = await mergeEventSettings(
      resolved,
      request({
        description: "",
        introEnabled: true,
        introLeadMinutes: 0,
        maxTeamSize: 2,
        myCoreBotDockerImage: "registry.example.com/bot:v1.2.3",
        startDate: resolved.startDate + 1000,
        submissionDeadline: resolved.startDate + 5000,
      }),
    );
    expect(merged).toMatchObject({
      description: "",
      introEnabled: true,
      introLeadMinutes: 0,
      maxTeamSize: 2,
      myCoreBotDockerImage: "registry.example.com/bot:v1.2.3",
      startDate: resolved.startDate + 1000,
      submissionDeadline: resolved.startDate + 5000,
      // Not overridden.
      minTeamSize: resolved.minTeamSize,
      scheduledEndDate: resolved.scheduledEndDate + 1000,
      gameConfig: resolved.gameConfig,
    });
  });

  it.each([24 * 60 * 60 * 1000, -24 * 60 * 60 * 1000])(
    "shifts missing dates by %s ms",
    async (delta) => {
      const merged = await mergeEventSettings(
        resolved,
        request({ startDate: resolved.startDate + delta }),
      );
      for (const field of [
        "startDate",
        "submissionDeadline",
        "scheduledEndDate",
        "endDate",
      ] as const)
        expect(merged[field]).toBe(resolved[field] + delta);
    },
  );

  it("preserves every explicit date when moving the start", async () => {
    const dates = {
      startDate: 1000,
      submissionDeadline: 2000,
      scheduledEndDate: 3000,
      endDate: 4000,
    };
    expect(await mergeEventSettings(resolved, request(dates))).toMatchObject(
      dates,
    );
  });

  it("always creates a private event", async () => {
    const merged = await mergeEventSettings(
      resolved,
      request({ isPrivate: false }),
    );
    expect(merged.isPrivate).toBe(true);
  });

  it("normalizes GitHub settings it merges", async () => {
    const merged = await mergeEventSettings(
      resolved,
      request({ monorepoUrl: "https://github.com/42core-team/monorepo/" }),
    );
    expect(merged.monorepoUrl).toBe("https://github.com/42core-team/monorepo");
  });

  it("ignores request fields that are not settings", async () => {
    const merged = await mergeEventSettings(resolved, {
      ...request({}),
      presetId: "11111111-1111-4111-8111-111111111111",
      githubOrg: "token-org",
      githubOrgSecret: "token",
    } as CreateEventDto);
    expect(merged).not.toHaveProperty("presetId");
    expect(merged).not.toHaveProperty("githubOrg");
    expect(merged).not.toHaveProperty("githubOrgSecret");
  });

  it.each([
    ["a team size below one", { minTeamSize: 0 }],
    ["a bad monorepo URL", { monorepoUrl: "https://gitlab.com/a/b" }],
    ["a null setting", { description: null }],
    ["a short name", { name: "ab" }],
  ])("rejects %s", async (_, body) => {
    await expect(
      mergeEventSettings(resolved, request(body)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a preset missing a required setting", async () => {
    const incomplete = { ...resolved, gameConfig: undefined };
    await expect(
      mergeEventSettings(incomplete as never, request({})),
    ).rejects.toMatchObject({
      response: { message: ["gameConfig must be a string"] },
    });
  });
});

describe("POST /event body", () => {
  const pipe = strictBody();
  const parse = (body: object) =>
    pipe.transform(body, { type: "body", metatype: CreateEventDto });

  it("needs only a name", async () => {
    await expect(parse({ name: "Summer Cup" })).resolves.toEqual({
      name: "Summer Cup",
    });
    await expect(parse({})).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    [{ githubOrg: "token-org" }],
    [{ githubOrgSecret: "token" }],
    [{ githubOrg: "token-org", githubOrgSecret: "token" }],
  ])("rejects the organizer token fields %p", async (fields) => {
    await expect(
      parse({ name: "Summer Cup", ...fields }),
    ).rejects.toMatchObject({
      response: {
        message: expect.arrayContaining([
          expect.stringMatching(
            /^property githubOrg(Secret)? should not exist$/,
          ),
        ]),
      },
    });
  });

  it("accepts every setting, the preset, installation and templates", async () => {
    const body = {
      name: "Summer Cup",
      presetId: "11111111-1111-4111-8111-111111111111",
      githubInstallationId: null,
      starterTemplates: [
        { name: "C", basePath: "bots/c/bot", myCoreBotDockerImage: "bot:dev" },
      ],
      ...resolved,
      isPrivate: true,
    };
    await expect(parse(body)).resolves.toMatchObject(body);
  });

  it.each([
    { starterTemplates: null },
    { presetId: null },
    { introEnabled: null },
  ])("rejects undocumented nulls %p", async (fields) => {
    await expect(
      parse({ name: "Summer Cup", ...fields }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("validates overrides with the event validators", async () => {
    await expect(
      parse({ name: "Summer Cup", basePath: "/etc" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      parse({ name: "Summer Cup", presetId: "default" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
