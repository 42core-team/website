/// <reference types="jest" />

const raw = jest.fn().mockResolvedValue("");
const env = jest.fn();
const simpleGitMock = jest.fn();

jest.mock("simple-git", () => ({
  simpleGit: simpleGitMock,
}));

jest.mock("./repo-validation", () => ({
  ...jest.requireActual("./repo-validation"),
  assertCheckoutInsideFolder: jest.fn().mockResolvedValue(undefined),
}));

import { RepoUtils } from "./repo.utils";

function clone(monoRepoUrl: string, version: string, basePath: string) {
  return new RepoUtils().cloneMonoRepo(
    monoRepoUrl,
    version,
    "bot-image",
    "visualizer-image",
    "./tmp/team-repo",
    "event",
    "Team",
    basePath,
    "",
    "",
    "https://api.example",
  );
}

describe("RepoUtils.cloneMonoRepo", () => {
  beforeEach(() => {
    raw.mockClear();
    env.mockClear();
    simpleGitMock.mockReset();
    const git = { raw, env, init: jest.fn().mockResolvedValue(undefined) };
    env.mockReturnValue(git);
    simpleGitMock.mockReturnValue(git);
  });

  it("clones over https only and ends options before positional arguments", async () => {
    await clone("https://github.com/42core-team/monorepo", "dev", "bots/c");

    expect(simpleGitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseDir: "./tmp/team-repo",
        allowEnvironment: ["GIT_ALLOW_PROTOCOL", "GIT_TERMINAL_PROMPT"],
      }),
    );
    const gitEnv = env.mock.calls[0][0] as Record<string, string>;
    expect(gitEnv).toMatchObject({
      GIT_ALLOW_PROTOCOL: "https",
      GIT_TERMINAL_PROMPT: "0",
    });
    expect(Object.keys(gitEnv)).not.toContain("API_SECRET_ENCRYPTION_KEY");
    expect(raw).toHaveBeenNthCalledWith(1, [
      "clone",
      "--filter=blob:none",
      "--sparse",
      "--branch",
      "dev",
      "--depth=1",
      "--",
      "https://github.com/42core-team/monorepo",
      ".",
    ]);
    expect(raw).toHaveBeenNthCalledWith(2, [
      "sparse-checkout",
      "set",
      "--",
      "bots/c",
    ]);
  });

  it.each([
    ["file:///etc", "dev", "bots"],
    ["https://github.com/a/b", "--upload-pack=id", "bots"],
    ["https://github.com/a/b", "dev", "../../app"],
    ["https://github.com/a/b", "dev", "/etc"],
  ])("refuses %p %p %p before running git", async (url, version, basePath) => {
    await expect(clone(url, version, basePath)).rejects.toThrow("Invalid");
    expect(simpleGitMock).not.toHaveBeenCalled();
    expect(raw).not.toHaveBeenCalled();
  });
});
