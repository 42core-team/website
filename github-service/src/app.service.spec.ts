/// <reference types="jest" />

import * as fs from "fs/promises";
import { ClientProxyFactory } from "@nestjs/microservices";
import { AppService } from "./app.service";
import { of } from "rxjs";
import { GitHubApiClient, RepositoryApi } from "./githubApi";
import { GithubAppAuth } from "./github-app-auth";
import { GithubAuth } from "./github-auth";

jest.mock("./main", () => ({
  getRabbitmqConfig: jest.fn().mockReturnValue({}),
}));

jest.mock("fs/promises", () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  rm: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("./githubApi", () => ({
  GitHubApiClient: jest.fn(),
  RepositoryApi: jest.fn().mockImplementation(() => ({
    createRepo: jest.fn().mockResolvedValue({ name: "team-repository" }),
    getRepository: jest.fn().mockRejectedValue({ status: 404 }),
    hasCommits: jest.fn().mockResolvedValue(true),
  })),
  UserApi: jest.fn(),
}));

const githubAuth: GithubAuth = { installationId: 42 };

const SIM_REPOSITORY = "sim-0b7e2f4c-3d1a-4e6b-9c8d-2a5f7e1b3c9d";

describe("AppService", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  const accessRequest = (repositoryName: string) => ({
    teamId: "team",
    operationId: "operation",
    repositoryName,
    githubOrg: "org",
    githubAuth: githubAuth,
    locked: true,
    githubUsers: [{ username: "member", githubId: "1", githubAccessToken: "" }],
  });

  describe("getRepositoryActivity", () => {
    function activityService(
      hasCommitsBeyondInitial: (
        owner: string,
        repo: string,
      ) => Promise<boolean>,
    ) {
      jest
        .spyOn(ClientProxyFactory, "create")
        .mockReturnValue({ emit: jest.fn() } as never);
      jest
        .mocked(RepositoryApi)
        .mockImplementationOnce(() => ({ hasCommitsBeyondInitial }) as never);
      const service = new AppService({} as never, new GithubAppAuth());
      jest.spyOn(service, "resolveGithubToken").mockResolvedValue("token");
      return service;
    }

    it("reports a failed check as unknown without failing the batch", async () => {
      const service = activityService(async (_owner, repo) => {
        if (repo === "broken")
          throw Object.assign(new Error(), { status: 404 });
        return repo === "pushed";
      });
      const results = await service.getRepositoryActivity(
        ["pushed", "idle", "broken"],
        "org",
        githubAuth,
      );
      expect(results).toEqual(
        expect.arrayContaining([
          { repositoryName: "pushed", status: "active" },
          { repositoryName: "idle", status: "inactive" },
          { repositoryName: "broken", status: "unknown" },
        ]),
      );
      expect(results).toHaveLength(3);
      expect(GitHubApiClient).toHaveBeenLastCalledWith({
        token: "token",
        maxRetries: 0,
        logErrors: false,
        requestTimeoutMs: 10000,
      });
    });

    it("reports unknown when no installation token can be obtained", async () => {
      process.env.NODE_ENV = "development";
      jest
        .spyOn(ClientProxyFactory, "create")
        .mockReturnValue({ emit: jest.fn() } as never);
      jest.mocked(RepositoryApi).mockClear();
      const service = new AppService({} as never, new GithubAppAuth());
      jest
        .spyOn(service, "resolveGithubToken")
        .mockRejectedValue(new Error("App not configured"));
      const results = await service.getRepositoryActivity(
        ["real-repo", SIM_REPOSITORY],
        "org",
        githubAuth,
      );
      expect(results).toEqual(
        expect.arrayContaining([
          { repositoryName: "real-repo", status: "unknown" },
          { repositoryName: SIM_REPOSITORY, status: "active" },
        ]),
      );
      expect(RepositoryApi).not.toHaveBeenCalled();
    });

    it("limits concurrent GitHub requests", async () => {
      let running = 0;
      let peak = 0;
      const service = activityService(async () => {
        peak = Math.max(peak, ++running);
        await new Promise((resolve) => setImmediate(resolve));
        running--;
        return true;
      });
      await service.getRepositoryActivity(
        Array.from({ length: 12 }, (_, index) => `repo-${index}`),
        "org",
        githubAuth,
      );
      expect(peak).toBe(5);
    });

    it("treats simulated repositories as active without calling GitHub", async () => {
      process.env.NODE_ENV = "development";
      const check = jest.fn();
      const service = activityService(check);
      await expect(
        service.getRepositoryActivity([SIM_REPOSITORY], "org", githubAuth),
      ).resolves.toEqual([
        { repositoryName: SIM_REPOSITORY, status: "active" },
      ]);
      expect(check).not.toHaveBeenCalled();
    });
  });

  it("reports a simulated lock without calling GitHub in development", async () => {
    process.env.NODE_ENV = "development";
    const emit = jest.fn().mockReturnValue(of(undefined));
    jest.spyOn(ClientProxyFactory, "create").mockReturnValue({ emit } as never);
    const service = new AppService({} as never, new GithubAppAuth());
    jest.mocked(RepositoryApi).mockClear();

    await service.setRepositoryAccess(accessRequest(SIM_REPOSITORY));

    expect(RepositoryApi).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith("repository_operation_completed", {
      teamId: "team",
      operationId: "operation",
      repositoryName: SIM_REPOSITORY,
      action: "LOCK",
    });
  });

  it.each<[string, (service: AppService) => Promise<unknown>]>([
    [
      "deleteRepository",
      (service) => service.deleteRepository(SIM_REPOSITORY, "org", githubAuth),
    ],
    [
      "removeUserFromRepository",
      (service) =>
        service.removeUserFromRepository(
          SIM_REPOSITORY,
          "member",
          "1",
          "org",
          githubAuth,
        ),
    ],
    [
      "addUserToRepository",
      (service) =>
        service.addUserToRepository(
          SIM_REPOSITORY,
          "member",
          "1",
          "org",
          githubAuth,
          "token",
        ),
    ],
    [
      "addWritePermissionsForUser",
      (service) =>
        service.addWritePermissionsForUser(
          "member",
          "1",
          "org",
          SIM_REPOSITORY,
          githubAuth,
        ),
    ],
    [
      "removeWritePermissionsForUser",
      (service) =>
        service.removeWritePermissionsForUser(
          "member",
          "1",
          "org",
          SIM_REPOSITORY,
          githubAuth,
        ),
    ],
    [
      "removeFormerCollaborators",
      (service) =>
        service.removeFormerCollaborators("org", SIM_REPOSITORY, githubAuth, [
          { username: "member", githubId: "1" },
        ]),
    ],
  ])(
    "simulates %s on sim-<uuid> repositories in development",
    async (_operation, run) => {
      process.env.NODE_ENV = "development";
      jest
        .spyOn(ClientProxyFactory, "create")
        .mockReturnValue({ emit: jest.fn() } as never);
      const service = new AppService({} as never, new GithubAppAuth());
      jest.spyOn(service, "resolveGithubToken").mockResolvedValue("token");
      jest.mocked(RepositoryApi).mockClear();
      jest.mocked(GitHubApiClient).mockClear();

      await run(service).catch(() => undefined);

      expect(GitHubApiClient).not.toHaveBeenCalled();
      expect(RepositoryApi).not.toHaveBeenCalled();
    },
  );

  it("does not simulate sim-* repositories outside development", async () => {
    process.env.NODE_ENV = "production";
    const emit = jest.fn().mockReturnValue(of(undefined));
    jest.spyOn(ClientProxyFactory, "create").mockReturnValue({ emit } as never);
    const service = new AppService({} as never, new GithubAppAuth());
    const removeFormerCollaborators = jest
      .spyOn(service, "removeFormerCollaborators")
      .mockResolvedValue(undefined);
    jest
      .spyOn(service, "removeWritePermissionsForUser")
      .mockResolvedValue(undefined);

    await service.setRepositoryAccess(accessRequest(SIM_REPOSITORY));

    expect(removeFormerCollaborators).toHaveBeenCalled();
  });

  it("locks a repository even when a member keeps inherited write access", async () => {
    jest
      .spyOn(ClientProxyFactory, "create")
      .mockReturnValue({ emit: jest.fn() } as never);
    const service = new AppService({} as never, new GithubAppAuth());
    jest.spyOn(service, "resolveGithubToken").mockResolvedValue("token");
    const updateCollaboratorPermission = jest.fn().mockResolvedValue(undefined);
    jest.mocked(RepositoryApi).mockImplementationOnce(
      () =>
        ({
          updateCollaboratorPermission,
          getCollaboratorPermission: jest.fn().mockResolvedValue("admin"),
        }) as never,
    );
    const warn = jest
      .spyOn(Reflect.get(service, "logger"), "warn")
      .mockImplementation(() => undefined);

    await expect(
      service.removeWritePermissionsForUser(
        "owner",
        "1",
        "org",
        "repo",
        githubAuth,
      ),
    ).resolves.toBeUndefined();
    expect(updateCollaboratorPermission).toHaveBeenCalledWith(
      "org",
      "repo",
      "owner",
      "pull",
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("inherited admin access"),
    );
  });

  it("acknowledges READY only after collaborators have access", async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    jest.spyOn(ClientProxyFactory, "create").mockReturnValue({ emit } as never);
    const service = new AppService({} as never, new GithubAppAuth());
    jest.spyOn(service, "resolveGithubToken").mockResolvedValue("token");
    const repoUtils = Reflect.get(service, "repoUtils");
    jest.spyOn(repoUtils, "cloneMonoRepo").mockResolvedValue({});
    jest.spyOn(repoUtils, "pushToTeamRepo").mockResolvedValue(undefined);
    let finish!: () => void;
    let started!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const adding = new Promise<void>((resolve) => {
      started = resolve;
    });
    jest.spyOn(service, "addUserToRepository").mockImplementation(async () => {
      started();
      await pending;
    });
    const operation = service.createTeamRepository(
      "repo",
      "team",
      [{ username: "user", githubId: "1", githubAccessToken: "token" }],
      "org",
      githubAuth,
      "team",
      "url",
      "main",
      "bot",
      "viz",
      "event",
      "base",
      "{}",
      "{}",
      "api",
      undefined,
      "operation",
    );
    await adding;
    expect(emit).not.toHaveBeenCalled();
    finish();
    await operation;
    expect(emit).toHaveBeenCalledWith("repository_operation_completed", {
      teamId: "team",
      operationId: "operation",
      repositoryName: "team-repository",
      action: "CREATE",
    });
  });

  it("reports permission errors instead of acknowledging a lock", async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    jest.spyOn(ClientProxyFactory, "create").mockReturnValue({ emit } as never);
    const service = new AppService({} as never, new GithubAppAuth());
    jest
      .spyOn(service, "removeWritePermissionsForUser")
      .mockRejectedValue(new Error("403"));
    await service.setRepositoryAccess({
      teamId: "team",
      operationId: "op",
      repositoryName: "repo",
      githubOrg: "org",
      githubAuth: githubAuth,
      locked: true,
      githubUsers: [
        { username: "user", githubId: "1", githubAccessToken: "token" },
      ],
    });
    expect(emit).toHaveBeenCalledWith(
      "repository_operation_completed",
      expect.objectContaining({
        operationId: "op",
        error: expect.stringContaining("permissions"),
      }),
    );
  });

  it("removes former members before acknowledging a permission change", async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    jest.spyOn(ClientProxyFactory, "create").mockReturnValue({ emit } as never);
    const repositoryApi = {
      listCollaborators: jest.fn().mockResolvedValue([
        { id: 1, login: "member", permissions: { admin: false } },
        { id: 2, login: "departed", permissions: { admin: false } },
        { id: 3, login: "org-admin", permissions: { admin: true } },
      ]),
      removeCollaborator: jest.fn().mockResolvedValue(undefined),
      listInvitations: jest.fn().mockResolvedValue([
        { id: 10, invitee: { id: 1, login: "member" } },
        { id: 11, invitee: { id: 4, login: "invited-then-left" } },
      ]),
      deleteInvitation: jest.fn().mockResolvedValue(undefined),
    };
    jest
      .mocked(RepositoryApi)
      .mockImplementationOnce(() => repositoryApi as never);
    const service = new AppService({} as never, new GithubAppAuth());
    jest.spyOn(service, "resolveGithubToken").mockResolvedValue("token");
    const removeWrite = jest
      .spyOn(service, "removeWritePermissionsForUser")
      .mockResolvedValue(undefined);
    await service.setRepositoryAccess({
      teamId: "team",
      operationId: "op",
      repositoryName: "repo",
      githubOrg: "org",
      githubAuth: githubAuth,
      locked: true,
      githubUsers: [
        { username: "member", githubId: "1", githubAccessToken: "token" },
      ],
    });
    expect(repositoryApi.removeCollaborator).toHaveBeenCalledTimes(1);
    expect(repositoryApi.removeCollaborator).toHaveBeenCalledWith(
      "org",
      "repo",
      "departed",
    );
    expect(repositoryApi.deleteInvitation).toHaveBeenCalledTimes(1);
    expect(repositoryApi.deleteInvitation).toHaveBeenCalledWith(
      "org",
      "repo",
      11,
    );
    expect(removeWrite).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      "repository_operation_completed",
      expect.not.objectContaining({ error: expect.anything() }),
    );
  });

  it("skips obsolete commands before touching GitHub", async () => {
    jest
      .spyOn(ClientProxyFactory, "create")
      .mockReturnValue({ send: jest.fn().mockReturnValue(of(false)) } as never);
    const service = new AppService({} as never, new GithubAppAuth());
    const action = jest.fn();
    await service.runRepositoryOperation("team", "obsolete", action);
    expect(action).not.toHaveBeenCalled();
  });

  it("resumes an existing repository without overwriting its commits", async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    jest.spyOn(ClientProxyFactory, "create").mockReturnValue({ emit } as never);
    jest.mocked(RepositoryApi).mockImplementationOnce(
      () =>
        ({
          getRepository: jest.fn().mockResolvedValue({ name: "existing" }),
          hasCommits: jest.fn().mockResolvedValue(true),
        }) as never,
    );
    const service = new AppService({} as never, new GithubAppAuth());
    jest.spyOn(service, "resolveGithubToken").mockResolvedValue("token");
    const push = jest.spyOn(
      Reflect.get(service, "repoUtils"),
      "pushToTeamRepo",
    );
    await service.createTeamRepository(
      "repo",
      "team",
      [],
      "org",
      githubAuth,
      "team",
      "url",
      "main",
      "bot",
      "viz",
      "event",
      "base",
      "{}",
      "{}",
      "api",
      undefined,
      "retry",
    );
    expect(push).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      "repository_operation_completed",
      expect.objectContaining({
        repositoryName: "existing",
        operationId: "retry",
      }),
    );
  });

  it("uses the event credentials when cleaning up a failed repository setup", async () => {
    const emit = jest.fn();
    jest.spyOn(ClientProxyFactory, "create").mockReturnValue({ emit } as never);

    const service = new AppService({} as never, new GithubAppAuth());
    const setupError = new Error("clone failed");
    jest.spyOn(service, "resolveGithubToken").mockResolvedValue("token");
    const deleteRepository = jest
      .spyOn(service, "deleteRepository")
      .mockResolvedValue(undefined);
    jest
      .spyOn(
        (
          service as unknown as {
            repoUtils: {
              cloneMonoRepo: (...args: unknown[]) => Promise<unknown>;
            };
          }
        ).repoUtils,
        "cloneMonoRepo",
      )
      .mockRejectedValue(setupError);

    await expect(
      service.createTeamRepository(
        "requested-name",
        "team-name",
        [],
        "github-org",
        githubAuth,
        "team-id",
        "https://example.com/mono.git",
        "main",
        "bot-image",
        "visualizer-image",
        "event-id",
        "base-path",
        "{}",
        "{}",
        "https://api.example.com",
      ),
    ).rejects.toBe(setupError);

    expect(deleteRepository).toHaveBeenCalledWith(
      "team-repository",
      "github-org",
      githubAuth,
    );
    expect(emit).not.toHaveBeenCalledWith(
      "repository_created",
      expect.anything(),
    );
    expect(fs.rm).toHaveBeenCalled();
  });
  describe("resolveGithubToken", () => {
    beforeEach(() => {
      jest
        .spyOn(ClientProxyFactory, "create")
        .mockReturnValue({ emit: jest.fn() } as never);
    });

    it("mints an installation token", async () => {
      const appAuth = new GithubAppAuth();
      jest.spyOn(appAuth, "isEnabled").mockReturnValue(true);
      jest
        .spyOn(appAuth, "getInstallationToken")
        .mockResolvedValue("installation-token");
      const service = new AppService({} as never, appAuth);
      await expect(service.resolveGithubToken(githubAuth)).resolves.toBe(
        "installation-token",
      );
      expect(appAuth.getInstallationToken).toHaveBeenCalledWith(42);
    });

    it("fails clearly when the App is not configured", async () => {
      const service = new AppService({} as never, new GithubAppAuth());
      await expect(service.resolveGithubToken(githubAuth)).rejects.toThrow(
        "not configured",
      );
    });
  });
});
