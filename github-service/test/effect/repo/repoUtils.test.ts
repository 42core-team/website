import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { FileSystem } from "@effect/platform";
import { Effect, Layer } from "effect";
import * as path from "node:path";
import type { SimpleGit } from "simple-git";

type GitMethod =
  | "clone"
  | "raw"
  | "init"
  | "addRemote"
  | "add"
  | "commit"
  | "branch"
  | "push";

type RepoUtilsService = {
  readonly cloneMonoRepo: (opts: {
    monoRepoUrl: string;
    monoRepoVersion: string;
    myCoreBotDockerImage: string;
    visualizerDockerImage: string;
    tempFolderPath: string;
    eventId: string;
    teamName: string;
    basePath: string;
    gameConfig: string;
    serverConfig: string;
    apiBaseUrl: string;
    starterTemplateId?: string;
  }) => Effect.Effect<SimpleGit, unknown, FileSystem.FileSystem>;
  readonly pushToTeamRepo: (opts: {
    teamRepo: { name: string; ssh_url: string; clone_url: string };
    decryptedGithubAccessToken: string;
    tempFolderPath: string;
    gitRepo: SimpleGit;
    basePath: string;
  }) => Effect.Effect<void, unknown, FileSystem.FileSystem>;
};

type RepoUtilsModule = typeof import("../../../src/effect/repo/repoUtils");

type MockGitRepo = {
  cwd: string;
  calls: Record<GitMethod, Array<Array<string>>>;
  api: SimpleGit;
};

const normalize = (p: string): string => path.posix.normalize(p.replace("\\", "/"));
const makeGitFailureKey = (cwd: string, method: GitMethod) => `${normalize(cwd)}::${method}`;

const gitRepos = new Map<string, MockGitRepo>();
const gitFailures = new Map<string, Error>();

const createMockGitRepo = (cwd: string): MockGitRepo => {
  const normalizedCwd = normalize(cwd);
  const calls: Record<GitMethod, Array<Array<string>>> = {
    clone: [],
    raw: [],
    init: [],
    addRemote: [],
    add: [],
    commit: [],
    branch: [],
    push: [],
  };

  const failIfConfigured = (method: GitMethod): Promise<void> => {
    const error = gitFailures.get(makeGitFailureKey(normalizedCwd, method));
    if (error) {
      return Promise.reject(error);
    }
    return Promise.resolve();
  };

  const api = {
    clone: async (repoUrl: string, localPath: string, options: Array<string>) => {
      calls.clone.push([repoUrl, localPath, ...options]);
      await failIfConfigured("clone");
      return api;
    },
    raw: async (args: Array<string>) => {
      calls.raw.push(args);
      await failIfConfigured("raw");
      return api;
    },
    init: async () => {
      calls.init.push([]);
      await failIfConfigured("init");
      return api;
    },
    addRemote: async (name: string, url: string) => {
      calls.addRemote.push([name, url]);
      await failIfConfigured("addRemote");
      return api;
    },
    add: async (files: string) => {
      calls.add.push([files]);
      await failIfConfigured("add");
      return api;
    },
    commit: async (message: string) => {
      calls.commit.push([message]);
      await failIfConfigured("commit");
      return api;
    },
    branch: async (args: Array<string>) => {
      calls.branch.push(args);
      await failIfConfigured("branch");
      return api;
    },
    push: async (remote: string, branch: string, options: Array<string>) => {
      calls.push.push([remote, branch, ...options]);
      await failIfConfigured("push");
      return api;
    },
  } as unknown as SimpleGit;

  return { cwd: normalizedCwd, calls, api };
};

mock.module("simple-git", () => ({
  default: (cwd: string) => {
    const normalizedCwd = normalize(cwd);
    const existing = gitRepos.get(normalizedCwd);
    if (existing) {
      return existing.api;
    }
    const created = createMockGitRepo(normalizedCwd);
    gitRepos.set(normalizedCwd, created);
    return created.api;
  },
}));

class MockFileSystem {
  private readonly files = new Map<string, string>();
  private readonly directories = new Set<string>();
  private readonly failures = new Map<string, Error>();

  constructor() {
    this.directories.add("/");
  }

  setFile(filePath: string, content: string): void {
    const normalized = normalize(filePath);
    this.files.set(normalized, content);
    this.ensureParentDirs(normalized);
  }

  getFile(filePath: string): string | undefined {
    return this.files.get(normalize(filePath));
  }

  setFailure(op: "stat" | "readFile" | "writeFileString" | "remove" | "makeDirectory", p: string, error: Error): void {
    this.failures.set(`${op}:${normalize(p)}`, error);
  }

  asService(): FileSystem.FileSystem {
    const checkFailure = (
      op: "stat" | "readFile" | "writeFileString" | "remove" | "makeDirectory",
      p: string,
    ): Error | undefined => this.failures.get(`${op}:${normalize(p)}`);

    return {
      stat: (p: string) => {
        const failure = checkFailure("stat", p);
        if (failure) return Effect.fail(failure);
        const normalized = normalize(p);
        if (this.files.has(normalized) || this.directories.has(normalized)) {
          return Effect.succeed({} as never);
        }
        return Effect.fail(new Error(`ENOENT: ${normalized}`));
      },
      readFile: (p: string) => {
        const failure = checkFailure("readFile", p);
        if (failure) return Effect.fail(failure);
        const normalized = normalize(p);
        const value = this.files.get(normalized);
        if (value === undefined) {
          return Effect.fail(new Error(`ENOENT: ${normalized}`));
        }
        return Effect.succeed(new TextEncoder().encode(value));
      },
      writeFileString: (p: string, content: string) => {
        const failure = checkFailure("writeFileString", p);
        if (failure) return Effect.fail(failure);
        const normalized = normalize(p);
        this.files.set(normalized, content);
        this.ensureParentDirs(normalized);
        return Effect.void;
      },
      remove: (p: string) => {
        const failure = checkFailure("remove", p);
        if (failure) return Effect.fail(failure);
        const normalized = normalize(p);
        this.files.delete(normalized);
        this.directories.delete(normalized);
        for (const key of Array.from(this.files.keys())) {
          if (key.startsWith(`${normalized}/`)) {
            this.files.delete(key);
          }
        }
        for (const key of Array.from(this.directories.values())) {
          if (key.startsWith(`${normalized}/`)) {
            this.directories.delete(key);
          }
        }
        return Effect.void;
      },
      makeDirectory: (p: string) => {
        const failure = checkFailure("makeDirectory", p);
        if (failure) return Effect.fail(failure);
        this.ensureDir(normalize(p));
        return Effect.void;
      },
    } as unknown as FileSystem.FileSystem;
  }

  private ensureParentDirs(filePath: string): void {
    this.ensureDir(path.posix.dirname(filePath));
  }

  private ensureDir(dirPath: string): void {
    const normalized = normalize(dirPath);
    if (normalized === ".") {
      this.directories.add("/");
      return;
    }
    const parts = normalized.split("/").filter((part) => part.length > 0);
    let current = "/";
    this.directories.add(current);
    for (const part of parts) {
      current = current === "/" ? `/${part}` : `${current}/${part}`;
      this.directories.add(current);
    }
  }
}

let repoUtilsModule: RepoUtilsModule | null = null;

const getRepoUtilsModule = async (): Promise<RepoUtilsModule> => {
  if (!repoUtilsModule) {
    repoUtilsModule = await import("../../../src/effect/repo/repoUtils");
  }
  return repoUtilsModule;
};

const runWithRepoUtils = async <A>(
  fs: MockFileSystem,
  program: (repoUtils: RepoUtilsService) => Effect.Effect<A, unknown, FileSystem.FileSystem>,
): Promise<A> => {
  const mod = await getRepoUtilsModule();
  const layer = Layer.provide(
    mod.RepoUtilsLive,
    Layer.succeed(FileSystem.FileSystem, fs.asService()),
  );

  const effectProgram = Effect.gen(function* () {
    const repoUtils = (yield* mod.RepoUtils) as RepoUtilsService;
    return yield* program(repoUtils);
  });

  return Effect.runPromise(effectProgram.pipe(Effect.provide(layer)));
};

const getGitRepo = (cwd: string): MockGitRepo => {
  const repo = gitRepos.get(normalize(cwd));
  if (!repo) {
    throw new Error(`Expected git repo for ${cwd}`);
  }
  return repo;
};

beforeAll(async () => {
  await getRepoUtilsModule();
});

beforeEach(() => {
  gitRepos.clear();
  gitFailures.clear();
});

describe("RepoUtilsLive.cloneMonoRepo", () => {
  it("clones the template and applies all repository transformations", async () => {
    const fs = new MockFileSystem();
    const tempFolderPath = "/tmp/team-repo-work";
    const basePath = "starter-template";
    const repoRoot = `${tempFolderPath}/${basePath}`;

    fs.setFile(`${repoRoot}/.coreignore`, "node_modules\n");
    fs.setFile(`${repoRoot}/.gitignore`, "dist\n");
    fs.setFile(
      `${repoRoot}/.devcontainer/docker-compose.yml`,
      [
        "services:",
        "  my-core-bot:",
        "    image: old-core:latest",
        "  visualizer:",
        "    image: old-visualizer:latest",
        "  helper:",
        "    image: keep-me:latest",
        "",
      ].join("\n"),
    );
    fs.setFile(
      `${repoRoot}/my-core-bot/src/main.c`,
      "const char* TEAM = \"YOUR TEAM NAME HERE\";\n",
    );
    fs.setFile(
      `${repoRoot}/scripts/check_update_configs.sh`,
      "curl [[event_url]]\n",
    );
    fs.setFile(
      `${repoRoot}/scripts/check_image_updates.sh`,
      "curl [[event_url]]\n",
    );

    await runWithRepoUtils(fs, (repoUtils) =>
      repoUtils.cloneMonoRepo({
        monoRepoUrl: "https://github.com/acme/mono.git",
        monoRepoVersion: "main",
        myCoreBotDockerImage: "ghcr.io/acme/my-core-bot:v2",
        visualizerDockerImage: "ghcr.io/acme/visualizer:v2",
        tempFolderPath,
        eventId: "event-123",
        teamName: "Ninjas",
        basePath,
        gameConfig: "{\"mode\":\"duel\"}",
        serverConfig: "{\"tickRate\":60}",
        apiBaseUrl: "https://api.example.com",
        starterTemplateId: "template-42",
      }),
    );

    const monoRepoGit = getGitRepo(tempFolderPath);
    expect(monoRepoGit.calls.clone).toEqual([
      [
        "https://github.com/acme/mono.git",
        "./",
        "--filter=blob:none",
        "--sparse",
        "--branch",
        "main",
        "--depth=1",
      ],
    ]);
    expect(monoRepoGit.calls.raw).toEqual([["sparse-checkout", "set", basePath]]);

    const teamRepoGit = getGitRepo(path.join(tempFolderPath, basePath));
    expect(teamRepoGit.calls.init).toHaveLength(1);

    expect(fs.getFile(`${repoRoot}/.coreignore`)).toBeUndefined();
    expect(fs.getFile(`${repoRoot}/.gitignore`)).toBe("dist\nnode_modules\n");

    const compose = fs.getFile(`${repoRoot}/.devcontainer/docker-compose.yml`) ?? "";
    expect(compose).toContain("image: ghcr.io/acme/my-core-bot:v2");
    expect(compose).toContain("image: ghcr.io/acme/visualizer:v2");
    expect(compose).toContain("image: keep-me:latest");

    expect(fs.getFile(`${repoRoot}/my-core-bot/src/main.c`)).toContain("Ninjas");
    expect(fs.getFile(`${repoRoot}/configs/game.config.json`)).toBe("{\"mode\":\"duel\"}");
    expect(fs.getFile(`${repoRoot}/configs/server.config.json`)).toBe("{\"tickRate\":60}");
    expect(fs.getFile(`${repoRoot}/scripts/check_update_configs.sh`)).toBe(
      "curl https://api.example.com/event/event-123\n",
    );
    expect(fs.getFile(`${repoRoot}/scripts/check_image_updates.sh`)).toBe(
      "curl https://api.example.com/event/event-123/templates/template-42\n",
    );
  });

  it("maps git command failures to RepoGitError", async () => {
    const fs = new MockFileSystem();
    const tempFolderPath = "/tmp/git-fail";
    gitFailures.set(
      makeGitFailureKey(tempFolderPath, "clone"),
      new Error("clone failed"),
    );

    await expect(
      runWithRepoUtils(fs, (repoUtils) =>
        repoUtils.cloneMonoRepo({
          monoRepoUrl: "https://github.com/acme/mono.git",
          monoRepoVersion: "main",
          myCoreBotDockerImage: "core:v1",
          visualizerDockerImage: "vis:v1",
          tempFolderPath,
          eventId: "event-1",
          teamName: "Alpha",
          basePath: "template",
          gameConfig: "{}",
          serverConfig: "{}",
          apiBaseUrl: "https://api.example.com",
        }),
      ),
    ).rejects.toThrow("git clone");
  });

  it("maps filesystem write failures to RepoIOError", async () => {
    const fs = new MockFileSystem();
    const tempFolderPath = "/tmp/io-fail";
    const basePath = "template";
    const repoRoot = `${tempFolderPath}/${basePath}`;

    fs.setFile(`${repoRoot}/scripts/check_update_configs.sh`, "curl [[event_url]]\n");
    fs.setFailure(
      "writeFileString",
      `${repoRoot}/scripts/check_update_configs.sh`,
      new Error("disk full"),
    );

    await expect(
      runWithRepoUtils(fs, (repoUtils) =>
        repoUtils.cloneMonoRepo({
          monoRepoUrl: "https://github.com/acme/mono.git",
          monoRepoVersion: "main",
          myCoreBotDockerImage: "core:v1",
          visualizerDockerImage: "vis:v1",
          tempFolderPath,
          eventId: "event-1",
          teamName: "Alpha",
          basePath,
          gameConfig: "",
          serverConfig: "",
          apiBaseUrl: "https://api.example.com",
        }),
      ),
    ).rejects.toThrow(`Failed to write ${repoRoot}/scripts/check_update_configs.sh`);
  });
});

describe("RepoUtilsLive.pushToTeamRepo", () => {
  it("updates README and pushes with token-authenticated remote URL", async () => {
    const fs = new MockFileSystem();
    const tempFolderPath = "/tmp/push-work";
    const basePath = "starter-template";
    const repoRoot = `${tempFolderPath}/${basePath}`;
    fs.setFile(`${repoRoot}/README.md`, "git clone your-repo-url\ncd my-core-bot\n");

    const { default: simpleGit } = await import("simple-git");
    const gitRepo = simpleGit(repoRoot) as SimpleGit;

    await runWithRepoUtils(fs, (repoUtils) =>
      repoUtils.pushToTeamRepo({
        teamRepo: {
          name: "my-core-bot-11111111-1111-1111-1111-111111111111",
          ssh_url: "git@github.com:acme/my-core-bot.git",
          clone_url: "https://github.com/acme/my-core-bot.git",
        },
        decryptedGithubAccessToken: "token-abc",
        tempFolderPath,
        gitRepo,
        basePath,
      }),
    );

    const updatedReadme = fs.getFile(`${repoRoot}/README.md`) ?? "";
    expect(updatedReadme).toContain(
      "git clone git@github.com:acme/my-core-bot.git my-core-bot",
    );
    expect(updatedReadme).toContain("cd my-core-bot");

    const repoCalls = getGitRepo(repoRoot).calls;
    expect(repoCalls.addRemote).toEqual([
      ["team-repo", "https://token-abc@github.com/acme/my-core-bot.git"],
    ]);
    expect(repoCalls.add).toEqual([["."]]);
    expect(repoCalls.commit).toEqual([["Initial commit"]]);
    expect(repoCalls.branch).toEqual([["-M", "main"]]);
    expect(repoCalls.push).toEqual([["team-repo", "main", "-u"]]);
  });

  it("maps push pipeline failures to RepoGitError", async () => {
    const fs = new MockFileSystem();
    const tempFolderPath = "/tmp/push-fail";
    const basePath = "starter-template";
    const repoRoot = `${tempFolderPath}/${basePath}`;
    fs.setFile(`${repoRoot}/README.md`, "git clone your-repo-url\ncd my-core-bot\n");

    gitFailures.set(makeGitFailureKey(repoRoot, "push"), new Error("push rejected"));
    const { default: simpleGit } = await import("simple-git");
    const gitRepo = simpleGit(repoRoot) as SimpleGit;

    expect(
      runWithRepoUtils(fs, (repoUtils) =>
        repoUtils.pushToTeamRepo({
          teamRepo: {
            name: "team-repo",
            ssh_url: "git@github.com:acme/team-repo.git",
            clone_url: "https://github.com/acme/team-repo.git",
          },
          decryptedGithubAccessToken: "token-abc",
          tempFolderPath,
          gitRepo,
          basePath,
        }),
      ),
    ).rejects.toThrow("git push");
  });
});

