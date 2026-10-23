/// <reference types="jest" />

import * as fs from "fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
  assertCheckoutInsideFolder,
  resolveInsideFolder,
  validateMonoRepoSource,
} from "./repo-validation";

const URL = "https://github.com/42core-team/monorepo";

describe("validateMonoRepoSource", () => {
  it("accepts the expected values", () => {
    expect(() =>
      validateMonoRepoSource(URL, "dev", "bots/c/softcore"),
    ).not.toThrow();
    expect(() =>
      validateMonoRepoSource(`${URL}.git`, "v1.2.3", "my-core-bot/"),
    ).not.toThrow();
  });

  it.each([
    "file:///etc",
    "ext::sh -c id",
    "--upload-pack=id",
    "https://token@github.com/a/b",
    "https://github.com.evil.example/a/b",
    "https://github.com/a/b/c",
    "ssh://git@github.com/a/b",
    "/srv/repo",
  ])("rejects the mono repo URL %p", (url) => {
    expect(() => validateMonoRepoSource(url, "dev", "bots")).toThrow(
      "Invalid mono repo URL",
    );
  });

  it.each(["-b", "--upload-pack=id", "a..b", "/main", "a b", ""])(
    "rejects the mono repo version %p",
    (version) => {
      expect(() => validateMonoRepoSource(URL, version, "bots")).toThrow(
        "Invalid mono repo version",
      );
    },
  );

  it.each(["", "/etc", "..", "../x", "a/../../x", "./a", "-a", "a//b", "*"])(
    "rejects the base path %p",
    (basePath) => {
      expect(() => validateMonoRepoSource(URL, "dev", basePath)).toThrow(
        "Invalid base path",
      );
    },
  );
});

describe("resolveInsideFolder", () => {
  it("resolves paths inside the folder", () => {
    expect(resolveInsideFolder("./tmp/x", "bots/c")).toBe(
      path.resolve("./tmp/x/bots/c"),
    );
    expect(resolveInsideFolder("/tmp/x", "..y/z")).toBe("/tmp/x/..y/z");
  });

  it.each(["../y", "a/../../y", "/etc"])("rejects %p", (relativePath) => {
    expect(() => resolveInsideFolder("/tmp/x", relativePath)).toThrow("leaves");
  });
});

describe("assertCheckoutInsideFolder", () => {
  let folder: string;
  let outside: string;

  beforeEach(async () => {
    folder = await fs.mkdtemp(path.join(os.tmpdir(), "repo-validation-"));
    outside = await fs.mkdtemp(path.join(os.tmpdir(), "repo-outside-"));
    await fs.mkdir(path.join(folder, "bots", "c", "configs"), {
      recursive: true,
    });
  });

  afterEach(async () => {
    await fs.rm(folder, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });

  it("accepts a checkout with relative inner symlinks", async () => {
    await fs.writeFile(path.join(folder, "bots", "c", "a.txt"), "a");
    await fs.symlink("a.txt", path.join(folder, "bots", "c", "link"));
    await fs.mkdir(path.join(folder, "bots", "c", ".git"));
    await fs.symlink("/etc", path.join(folder, "bots", "c", ".git", "x"));

    await expect(
      assertCheckoutInsideFolder(folder, path.join(folder, "bots", "c")),
    ).resolves.toBeUndefined();
  });

  it("rejects a checkout reached through a symlinked parent", async () => {
    await fs.symlink(outside, path.join(folder, "escape"));

    await expect(
      assertCheckoutInsideFolder(folder, path.join(folder, "escape")),
    ).rejects.toThrow("resolves outside");
  });

  it.each([
    ["an absolute symlink", () => "/etc"],
    ["a parent symlink", () => "../../.."],
    ["a dangling parent symlink", () => "../../../../nowhere/file"],
  ])("rejects %s inside the checkout", async (_, target) => {
    await fs.symlink(
      target(),
      path.join(folder, "bots", "c", "configs", "game.config.json"),
    );

    await expect(
      assertCheckoutInsideFolder(folder, path.join(folder, "bots", "c")),
    ).rejects.toThrow("points outside");
  });
});
