/// <reference types="jest" />

import * as fs from "fs/promises";
import { ClientProxyFactory } from "@nestjs/microservices";
import { AppService } from "./app.service";

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
  })),
  UserApi: jest.fn(),
}));

describe("AppService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
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
