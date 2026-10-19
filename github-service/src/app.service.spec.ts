/// <reference types="jest" />

import * as fs from "fs/promises";
import { ClientProxyFactory } from "@nestjs/microservices";
import { AppService } from "./app.service";
import { of } from "rxjs";
import { RepositoryApi } from "./githubApi";

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

describe("AppService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("acknowledges READY only after collaborators have access", async () => {
    const emit = jest.fn().mockReturnValue(of(undefined));
    jest.spyOn(ClientProxyFactory, "create").mockReturnValue({ emit } as never);
    const service = new AppService({} as never);
    jest.spyOn(service, "decryptSecret").mockReturnValue("token");
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
      "secret",
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
    const service = new AppService({} as never);
    jest
      .spyOn(service, "removeWritePermissionsForUser")
      .mockRejectedValue(new Error("403"));
    await service.setRepositoryAccess({
      teamId: "team",
      operationId: "op",
      repositoryName: "repo",
      githubOrg: "org",
      encryptedSecret: "secret",
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

  it("skips obsolete commands before touching GitHub", async () => {
    jest
      .spyOn(ClientProxyFactory, "create")
      .mockReturnValue({ send: jest.fn().mockReturnValue(of(false)) } as never);
    const service = new AppService({} as never);
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
    const service = new AppService({} as never);
    jest.spyOn(service, "decryptSecret").mockReturnValue("token");
    const push = jest.spyOn(
      Reflect.get(service, "repoUtils"),
      "pushToTeamRepo",
    );
    await service.createTeamRepository(
      "repo",
      "team",
      [],
      "org",
      "secret",
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

  it("uses the encrypted event token when cleaning up a failed repository setup", async () => {
    const emit = jest.fn();
    jest.spyOn(ClientProxyFactory, "create").mockReturnValue({ emit } as never);

    const service = new AppService({} as never);
    const setupError = new Error("clone failed");
    const encryptedEventToken = "v2:encrypted-event-token";

    jest.spyOn(service, "decryptSecret").mockReturnValue("plaintext-token");
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
        encryptedEventToken,
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
      encryptedEventToken,
    );
    expect(emit).not.toHaveBeenCalledWith(
      "repository_created",
      expect.anything(),
    );
    expect(fs.rm).toHaveBeenCalled();
  });
});
