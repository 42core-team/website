import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateEventStarterTemplateDto } from "../event/dtos/createEventStarterTemplateDto";
import { UpdateEventSettingsDto } from "../event/dtos/updateEventSettingsDto";
import { UpdateEventStarterTemplateDto } from "../event/dtos/updateEventStarterTemplateDto";
import { CreateEventDto } from "../event/dtos/createEventDto";
import {
  GIT_REF_PATTERN,
  GITHUB_OWNER_PATTERN,
  GITHUB_REPO_NAME_PATTERN,
  GITHUB_REPO_URL_PATTERN,
  REPO_RELATIVE_PATH_PATTERN,
} from "./github-validation";

describe("GitHub event config validation patterns", () => {
  it.each([
    [GITHUB_OWNER_PATTERN, ["core", "42core-team", "a", "a".repeat(39)]],
    [
      GITHUB_REPO_NAME_PATTERN,
      ["monorepo", "my-core-bot.git", ".github", "Event-Team_1.x"],
    ],
    [
      GITHUB_REPO_URL_PATTERN,
      [
        "https://github.com/42core-team/monorepo",
        "https://github.com/42core-team/monorepo.git",
      ],
    ],
    [GIT_REF_PATTERN, ["dev", "main", "v1.2.3", "release/2025-09", "feat_x"]],
    [
      REPO_RELATIVE_PATH_PATTERN,
      ["bots/c/softcore", "my-core-bot", "bots/c/softcore/", ".config/x"],
    ],
  ])("accepts valid values for %s", (pattern, values) => {
    for (const value of values) expect(pattern.test(value)).toBe(true);
  });

  it.each([
    [
      GITHUB_OWNER_PATTERN,
      ["", "-core", "core-", "co--re", "co re", "a".repeat(40), "core/x"],
    ],
    [GITHUB_REPO_NAME_PATTERN, ["", ".", "..", "a/b", "a b", "a;b"]],
    [
      GITHUB_REPO_URL_PATTERN,
      [
        "http://github.com/a/b",
        "https://gitlab.com/a/b",
        "https://github.com.evil.example/a/b",
        "https://user:token@github.com/a/b",
        "https://github.com/a",
        "https://github.com/a/b/c",
        "https://github.com/a/..",
        "https://github.com/-a/b",
        "https://github.com/a/b?x=1",
        "https://github.com/a/b#x",
        "file:///etc/passwd",
        "ext::sh -c id",
        "--upload-pack=id",
        "/local/path",
      ],
    ],
    [
      GIT_REF_PATTERN,
      [
        "",
        "-b",
        "--upload-pack=id",
        "a..b",
        "/main",
        "main/",
        "a//b",
        "x.lock",
        "a b",
        "a;b",
        "@{1}",
      ],
    ],
    [
      REPO_RELATIVE_PATH_PATTERN,
      [
        "",
        "/etc",
        "..",
        "../x",
        "a/../../x",
        "a/./b",
        ".",
        "a//b",
        "-x",
        "a/-x",
        "a b",
        "a\\b",
        "*",
        "!x",
      ],
    ],
  ])("rejects invalid values for %s", (pattern, values) => {
    for (const value of values) expect(pattern.test(value)).toBe(false);
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
});
