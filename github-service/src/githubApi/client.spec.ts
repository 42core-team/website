/// <reference types="jest" />

import { GitHubApiClient } from "./client";
import { RepositoryApi } from "./endpoints";

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), { status, headers });
}

describe("activity check over the GitHub client", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    jest.spyOn(global, "fetch").mockImplementation(fetchMock);
  });

  afterEach(() => jest.restoreAllMocks());

  const repositoryApi = () =>
    new RepositoryApi(
      new GitHubApiClient({
        token: "token",
        maxRetries: 0,
        logErrors: false,
        requestTimeoutMs: 10000,
      }),
    );

  it.each([
    [[], false],
    [[{}], false],
    [[{}, {}], true],
  ])("classifies the commits %j as %s", async (commits, expected) => {
    fetchMock.mockResolvedValue(jsonResponse(commits));
    await expect(
      repositoryApi().hasCommitsBeyondInitial("org", "repo"),
    ).resolves.toBe(expected);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "repos/org/repo/commits?per_page=2",
    );
  });

  it("treats an empty repository as having no further commits", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 409));
    await expect(
      repositoryApi().hasCommitsBeyondInitial("org", "repo"),
    ).resolves.toBe(false);
  });

  it("fails at once instead of waiting for the rate limit to reset", async () => {
    const delay = jest.spyOn(
      GitHubApiClient.prototype as unknown as {
        delay(ms: number): Promise<void>;
      },
      "delay",
    );
    fetchMock.mockResolvedValue(
      jsonResponse({}, 403, {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 300),
      }),
    );

    await expect(
      repositoryApi().hasCommitsBeyondInitial("org", "repo"),
    ).rejects.toThrow("Rate limit");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });

  it("does not retry a missing repository and keeps its status", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 404));
    await expect(
      repositoryApi().hasCommitsBeyondInitial("org", "repo"),
    ).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives each request a deadline", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await repositoryApi().hasCommitsBeyondInitial("org", "repo");
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});
