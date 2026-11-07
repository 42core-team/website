import { of, throwError } from "rxjs";
import { ClientProxyFactory } from "@nestjs/microservices";

jest.mock("../main", () => ({
  getRabbitmqConfig: jest.fn().mockReturnValue({}),
}));

import { GithubApiService } from "./github-api.service";

describe("GithubApiService.getRepositoryActivity", () => {
  const names = Array.from({ length: 60 }, (_, index) => `repo-${index}`);
  const active = (repositoryNames: string[]) =>
    repositoryNames.map((repositoryName) => ({
      repositoryName,
      status: "active",
    }));

  afterEach(() => jest.restoreAllMocks());

  function service(send: jest.Mock) {
    jest.spyOn(ClientProxyFactory, "create").mockReturnValue({ send } as never);
    return new GithubApiService({} as never);
  }

  it("checks repositories in batches and combines the results", async () => {
    const send = jest.fn((_pattern, data) => of(active(data.repositoryNames)));
    const results = await service(send).getRepositoryActivity(
      names,
      "org",
      "secret",
    );
    expect(
      send.mock.calls.map(([, data]) => data.repositoryNames.length),
    ).toEqual([25, 25, 10]);
    expect(results).toHaveLength(60);
  });

  it("keeps completed batches when a later one fails", async () => {
    const send = jest
      .fn()
      .mockImplementationOnce((_pattern, data) =>
        of(active(data.repositoryNames)),
      )
      .mockImplementationOnce(() => throwError(() => new Error("timeout")));
    const results = await service(send).getRepositoryActivity(
      names,
      "org",
      "secret",
    );
    expect(results).toHaveLength(25);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("fails when nothing could be checked", async () => {
    const send = jest.fn(() => throwError(() => new Error("timeout")));
    await expect(
      service(send).getRepositoryActivity(names, "org", "secret"),
    ).rejects.toThrow("timeout");
  });

  it("stops after a batch with only unknown results", async () => {
    const send = jest.fn((_pattern, data) =>
      of(
        data.repositoryNames.map((repositoryName: string) => ({
          repositoryName,
          status: "unknown",
        })),
      ),
    );
    await service(send).getRepositoryActivity(names, "org", "secret");
    expect(send).toHaveBeenCalledTimes(1);
  });
});
