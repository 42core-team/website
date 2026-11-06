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
    expect(simpleGitMock.mock.calls[0][0]).not.toHaveProperty("unsafe");
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

describe("RepoUtils.pushToTeamRepo", () => {
  const token = "ghp_secret-token";
  const cloneUrl = "https://github.com/core-org/team-repo.git";

  function createGit() {
    const calls: string[] = [];
    const git = {
      addRemote: jest.fn(async () => void calls.push("addRemote")),
      add: jest.fn(async () => void calls.push("add")),
      commit: jest.fn(async () => void calls.push("commit")),
      branch: jest.fn(async () => void calls.push("branch")),
      push: jest.fn(async () => void calls.push("push")),
      env: jest.fn(() => {
        calls.push("env");
        return git;
      }),
    };
    return { git, calls };
  }

  function push(git: ReturnType<typeof createGit>["git"]) {
    return new RepoUtils().pushToTeamRepo(
      {
        name: "team-repo",
        clone_url: cloneUrl,
        ssh_url: "git@github.com:core-org/team-repo.git",
      } as never,
      token,
      "./tmp/team-repo",
      git as never,
      "bots/c",
    );
  }

  it("sends the token in a header scoped to the remote's origin", async () => {
    const { git } = createGit();

    await push(git);

    const gitEnv = (git.env.mock.calls as unknown[][])[0][0];
    expect(gitEnv).toMatchObject({
      GIT_ALLOW_PROTOCOL: "https",
      GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "http.https://github.com/.extraHeader",
      GIT_CONFIG_VALUE_0: `Authorization: Basic ${Buffer.from(
        `x-access-token:${token}`,
      ).toString("base64")}`,
    });
    expect(git.push).toHaveBeenCalledWith("team-repo", "main", ["-u"]);
  });

  it("keeps the token out of the remote URL and git arguments", async () => {
    const { git } = createGit();

    await push(git);

    expect(git.addRemote).toHaveBeenCalledWith("team-repo", cloneUrl);
    for (const mock of [
      git.addRemote,
      git.add,
      git.commit,
      git.branch,
      git.push,
    ])
      expect(JSON.stringify(mock.mock.calls)).not.toContain(token);
  });

  it("allows every git variable it sets through simple-git's guard", async () => {
    const { git } = createGit();
    simpleGitMock.mockReset();
    env.mockReset();
    env.mockReturnValue({
      raw,
      init: jest.fn().mockResolvedValue(undefined),
      env,
    });
    simpleGitMock.mockImplementation(() => ({
      raw,
      env,
      init: jest.fn().mockResolvedValue(undefined),
    }));

    await clone("https://github.com/42core-team/monorepo", "dev", "bots/c");
    const teamRepoOptions = simpleGitMock.mock.calls.at(-1)?.[0] as {
      allowEnvironment: string[];
      unsafe: { allowUnsafeConfigEnvCount: boolean };
    };
    await push(git);

    const gitEnv = (git.env.mock.calls as unknown[][])[0][0] as object;
    const gitKeys = Object.keys(gitEnv).filter((key) => key.startsWith("GIT_"));
    expect(teamRepoOptions.allowEnvironment).toEqual(
      expect.arrayContaining(gitKeys),
    );
    expect(teamRepoOptions.unsafe.allowUnsafeConfigEnvCount).toBe(true);
  });

  it("only sets the push environment for the push itself", async () => {
    const { git, calls } = createGit();

    await push(git);

    expect(calls).toEqual([
      "addRemote",
      "add",
      "commit",
      "branch",
      "env",
      "push",
    ]);
  });
});
