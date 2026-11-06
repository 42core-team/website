jest.mock("../main", () => ({ getRabbitmqConfig: jest.fn() }));

import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateEventStarterTemplateDto } from "../event/dtos/createEventStarterTemplateDto";
import { UpdateEventSettingsDto } from "../event/dtos/updateEventSettingsDto";
import { UpdateEventStarterTemplateDto } from "../event/dtos/updateEventStarterTemplateDto";
import { CreateEventDto } from "../event/dtos/createEventDto";
import { ValidationPipe } from "@nestjs/common";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { RouteParamtypes } from "@nestjs/common/enums/route-paramtypes.enum";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EventController } from "../event/event.controller";
import { NormalizeGithubConfigPipe } from "./github-config-normalization";
import {
  GITHUB_CONFIG_NORMALIZERS,
  GithubConfigField,
  normalizeGithubConfigBody,
  normalizeGithubConfigValue,
  GIT_REF_MESSAGE,
  GIT_REF_PATTERN,
  GITHUB_OWNER_PATTERN,
  GITHUB_REPO_NAME_PATTERN,
  GITHUB_REPO_URL_PATTERN,
  REPO_RELATIVE_PATH_PATTERN,
} from "./github-validation";

type PatternName = keyof typeof PATTERNS;

const PATTERNS = {
  GITHUB_OWNER_PATTERN,
  GITHUB_REPO_NAME_PATTERN,
  GITHUB_REPO_URL_PATTERN,
  GIT_REF_PATTERN,
  REPO_RELATIVE_PATH_PATTERN,
};

/** Shared with the frontend tests (frontend/src/lib/github-validation.test.ts). */
const fixtures = JSON.parse(
  readFileSync(join(__dirname, "github-validation.fixtures.json"), "utf8"),
) as {
  patterns: Record<PatternName, { valid: string[]; invalid: string[] }>;
  normalization: Record<GithubConfigField, [string, string][]>;
};

describe("GitHub event config validation patterns", () => {
  it("has fixtures for every pattern", () => {
    expect(Object.keys(fixtures.patterns).sort()).toEqual(
      Object.keys(PATTERNS).sort(),
    );
  });

  it.each(Object.keys(PATTERNS) as PatternName[])(
    "accepts the valid fixture values for %s",
    (name) => {
      const rejected = fixtures.patterns[name].valid.filter(
        (value) => !PATTERNS[name].test(value),
      );
      expect(rejected).toEqual([]);
    },
  );

  it.each(Object.keys(PATTERNS) as PatternName[])(
    "rejects the invalid fixture values for %s",
    (name) => {
      const accepted = fixtures.patterns[name].invalid.filter((value) =>
        PATTERNS[name].test(value),
      );
      expect(accepted).toEqual([]);
    },
  );
});

describe("GitHub config normalization", () => {
  it.each(Object.keys(GITHUB_CONFIG_NORMALIZERS) as GithubConfigField[])(
    "normalizes %s as listed in the fixtures",
    (field) => {
      for (const [input, expected] of fixtures.normalization[field])
        expect(normalizeGithubConfigValue(field, input)).toBe(expected);
    },
  );

  it("leaves non-string values alone", () => {
    expect(normalizeGithubConfigValue("monorepoUrl", 42)).toBe(42);
    expect(normalizeGithubConfigValue("githubOrg", undefined)).toBeUndefined();
  });

  it("normalizes only the GitHub config fields of a body", () => {
    const body = { name: " x ", basePath: " bots/c ", monorepoUrl: 1 };
    expect(normalizeGithubConfigBody(body)).toEqual({
      name: " x ",
      basePath: "bots/c",
      monorepoUrl: 1,
    });
    expect(body.basePath).toBe(" bots/c ");
    expect("githubOrg" in normalizeGithubConfigBody(body)).toBe(false);
  });
});

describe("event DTO validation", () => {
  const validCreateEvent = {
    name: "Event",
    githubOrg: "core-org",
    githubOrgSecret: "secret",
    startDate: Date.now(),
    minTeamSize: 1,
    maxTeamSize: 3,
    gameServerDockerImage: "ghcr.io/42core-team/game-server:v1",
    myCoreBotDockerImage: "ghcr.io/42core-team/my-core-bot:v1",
    visualizerDockerImage: "ghcr.io/42core-team/visualizer:v1",
    monorepoUrl: "https://github.com/42core-team/monorepo",
    monorepoVersion: "dev",
    basePath: "bots/c/softcore",
    gameConfig: "{}",
    serverConfig: "{}",
    isPrivate: false,
  };

  async function invalidFields(cls: new () => object, body: object) {
    const errors = await validate(plainToInstance(cls, body));
    return errors.map((error) => error.property);
  }

  it("accepts a valid event", async () => {
    expect(await invalidFields(CreateEventDto, validCreateEvent)).toEqual([]);
  });

  it.each([
    ["githubOrg", "org:token@evil"],
    ["monorepoUrl", "file:///etc"],
    ["monorepoVersion", "--upload-pack=id"],
    ["basePath", "../../app"],
  ])("rejects an invalid %s on create and update", async (field, value) => {
    expect(
      await invalidFields(CreateEventDto, {
        ...validCreateEvent,
        [field]: value,
      }),
    ).toEqual([field]);
    expect(
      await invalidFields(UpdateEventSettingsDto, { [field]: value }),
    ).toEqual([field]);
  });

  it("allows updates that leave the validated fields out", async () => {
    expect(await invalidFields(UpdateEventSettingsDto, { name: "x" })).toEqual(
      [],
    );
  });

  it("validates starter template base paths", async () => {
    const template = { name: "C", myCoreBotDockerImage: "img" };
    expect(
      await invalidFields(CreateEventStarterTemplateDto, {
        ...template,
        basePath: "bots/c",
      }),
    ).toEqual([]);
    expect(
      await invalidFields(CreateEventStarterTemplateDto, {
        ...template,
        basePath: "/etc",
      }),
    ).toEqual(["basePath"]);
    expect(
      await invalidFields(UpdateEventStarterTemplateDto, {
        basePath: "a/../..",
      }),
    ).toEqual(["basePath"]);
  });

  it("accepts surrounding whitespace and a trailing slash on the repo URL", async () => {
    const padded = {
      githubOrg: " core-org ",
      monorepoUrl: " https://github.com/42core-team/monorepo/ ",
      monorepoVersion: "dev\n",
      basePath: " bots/c/softcore ",
    };
    expect(
      await invalidFields(CreateEventDto, { ...validCreateEvent, ...padded }),
    ).toEqual([]);
    expect(await invalidFields(UpdateEventSettingsDto, padded)).toEqual([]);
    expect(
      await invalidFields(UpdateEventStarterTemplateDto, {
        basePath: " bots/c ",
      }),
    ).toEqual([]);
  });

  it.each([
    ["githubOrg", " -core "],
    ["monorepoUrl", "https://github.com/a/b//"],
    ["monorepoUrl", "https://github.com/a/"],
    ["monorepoVersion", " -b "],
    ["basePath", " ../x "],
  ])("still rejects %s %j after normalization", async (field, value) => {
    expect(
      await invalidFields(UpdateEventSettingsDto, { [field]: value }),
    ).toEqual([field]);
  });

  it("rejects a whitespace-only starter template base path", async () => {
    expect(
      await invalidFields(CreateEventStarterTemplateDto, {
        name: "C",
        myCoreBotDockerImage: "img",
        basePath: "   ",
      }),
    ).toEqual(["basePath"]);
  });
});

describe("GitHub config normalization in the request pipeline", () => {
  const body = {
    monorepoUrl: " https://github.com/42core-team/monorepo/ ",
    basePath: " bots/c ",
    name: " Event ",
  };
  const metadata = {
    type: "body" as const,
    metatype: UpdateEventSettingsDto,
    data: undefined,
  };

  it("hands the handler the normalized values that were validated", async () => {
    const validated: unknown = await new ValidationPipe().transform(
      body,
      metadata,
    );
    // Without `transform: true` the global pipe returns the original body.
    expect(validated).toBe(body);
    expect(new NormalizeGithubConfigPipe().transform(validated)).toEqual({
      monorepoUrl: "https://github.com/42core-team/monorepo",
      basePath: "bots/c",
      name: " Event ",
    });
  });

  it("returns readable validation messages", async () => {
    await expect(
      new ValidationPipe().transform({ monorepoVersion: "-b" }, metadata),
    ).rejects.toMatchObject({
      response: { message: [GIT_REF_MESSAGE] },
    });
  });

  it.each([
    "createEvent",
    "updateEventSettings",
    "createStarterTemplate",
    "updateStarterTemplate",
  ])("applies NormalizeGithubConfigPipe to the body of %s", (handler) => {
    const args = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      EventController,
      handler,
    ) as Record<string, { pipes?: unknown[] }>;
    const bodyArg = Object.entries(args).find(([key]) =>
      key.startsWith(`${RouteParamtypes.BODY}:`),
    )?.[1];
    expect(bodyArg?.pipes).toContain(NormalizeGithubConfigPipe);
  });
});
